"""Independent profiles and atomic unlink-on-archive."""
from shared.errors import ApiError
from shared.models import now, epoch, new_id, normalize, paginate, public
from users_api.repositories.dynamodb import Store, RETENTION, MAX_LINKS, require_role, get_profile, touch
from users_api.validators.catechists import validate_payload


def listing(request, principal, management=False):
    require_role(principal, 'reader', 'editor', 'admin')
    store = Store()
    query = request.get('query', {})
    if set(query) - {'q', 'cursor', 'limit', 'includeDeleted'}:
        raise ApiError(400, 'VALIDATION_ERROR', 'Unknown query parameter.')
    if 'includeDeleted' in query and (not management or query['includeDeleted'] not in ('true', 'false')):
        raise ApiError(400, 'VALIDATION_ERROR', 'Invalid includeDeleted.')
    search = normalize(query.get('q', ''))
    items = []
    for entry in store.query_index('DIRECTORY#CATECHIST'):
        item = store.get(entry['PK'])
        if (item and item.get('purgeAt', epoch() + 1) > epoch()
                and (not item.get('deletedAt') or (management and query.get('includeDeleted') == 'true'))
                and search in item.get('normalizedName', '')):
            items.append(item)
    items.sort(key=lambda i: (i['normalizedName'], i['catechistId']))
    return paginate([public(i) for i in items], query, 'manage-catechists' if management else 'catechists')


def list_profiles(request, principal):
    return listing(request, principal)


def list_management(request, principal):
    require_role(principal, 'editor', 'admin')
    return listing(request, principal, True)


def create_profile(request, principal):
    require_role(principal, 'editor', 'admin')
    payload = validate_payload(request['body'])
    identifier = new_id('cat')
    stamp = now()
    item = {**payload, 'PK': 'CATECHIST#' + identifier, 'SK': 'PROFILE',
            'entityType': 'CATECHIST', 'catechistId': identifier, 'normalizedName': normalize(payload['name']),
            'version': 1, 'createdAt': stamp, 'updatedAt': stamp,
            'createdBy': principal['sub'], 'updatedBy': principal['sub'],
            'GSI1PK': 'DIRECTORY#CATECHIST', 'GSI1SK': normalize(payload['name']) + '#' + identifier}
    Store().put(item, create=True)
    return public(item)


def update_profile(request, principal):
    require_role(principal, 'editor', 'admin')
    payload = validate_payload(request['body'], updating=True)
    store = Store()
    old = get_profile(store, request['path_parameters']['catechistId'])
    if old['version'] != payload['version']:
        raise ApiError(409, 'VERSION_CONFLICT', 'Profile changed.', {'version': old['version']})
    item = touch({**old, **payload}, principal)
    item.update(normalizedName=normalize(item['name']), GSI1SK=normalize(item['name']) + '#' + old['catechistId'])
    store.put(item, expected_version=old['version'])
    return public(item)


def archive_profile(request, principal):
    require_role(principal, 'editor', 'admin')
    store = Store()
    old = get_profile(store, request['path_parameters']['catechistId'], deleted=True)
    if old.get('deletedAt'):
        return public(old)
    links = [i for i in store.query(old['PK']) if i['SK'].startswith('ACCOUNT#')]
    if len(links) > MAX_LINKS:
        raise ApiError(409, 'VERSION_CONFLICT', 'Too many profile links for atomic archive.')
    item = touch(old, principal)
    item.update(deletedAt=now(), purgeAt=epoch() + RETENTION)
    # Retain metadata index for the editor trash view; reader list rechecks deletedAt.
    writes = [{'put': item, 'version': old['version']}]
    for link in links:
        account = store.get('ACCOUNT#' + link['cognitoSub'])
        if account and account.get('catechistId') == old['catechistId']:
            changed = touch(account, principal)
            changed.pop('catechistId', None)
            writes.append({'put': changed, 'version': account['version']})
        writes.append({'delete': {'PK': link['PK'], 'SK': link['SK']}})
    store.transact(writes)
    return public(item)


def restore_profile(request, principal):
    require_role(principal, 'editor', 'admin')
    store = Store()
    old = get_profile(store, request['path_parameters']['catechistId'], deleted=True)
    if not old.get('deletedAt'):
        return public(old)
    item = touch(old, principal)
    item.pop('deletedAt', None)
    item.pop('purgeAt', None)
    item.update(GSI1PK='DIRECTORY#CATECHIST', GSI1SK=item['normalizedName'] + '#' + item['catechistId'])
    store.put(item, expected_version=old['version'])
    return public(item)
