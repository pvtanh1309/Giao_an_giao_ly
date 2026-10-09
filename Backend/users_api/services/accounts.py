"""Admin-only account lifecycle with Cognito compensation and durable transitions."""
import logging
from shared.errors import ApiError
from shared.models import now, epoch, new_id, normalize, paginate, public
from users_api.repositories.dynamodb import Store, RETENTION, require_role, get_profile, touch, link_writes
from users_api.repositories.cognito import Cognito
from users_api.validators.accounts import validate_payload, password
from users_api.validators.catechists import fields, text, invalid

log = logging.getLogger(__name__)


def view(item):
    return public({k: v for k, v in item.items() if k not in ('cognitoUsername', 'pendingAction', 'pendingStatus', 'pendingUntil', 'pendingToken')})


def account(store, request, deleted=False):
    sub = request['path_parameters']['cognitoSub']
    item = store.get('ACCOUNT#' + sub)
    if not item or item.get('purgeAt', epoch() + 1) <= epoch() or (item.get('accountStatus') == 'DELETED' and not deleted):
        raise ApiError(404, 'NOT_FOUND', 'Account not found.')
    return item


def protect(item):
    if item.get('role') == 'ADMIN':
        raise ApiError(409, 'LAST_ADMIN_PROTECTED', 'Admin accounts are managed outside this API.')


def list_accounts(request, principal):
    require_role(principal, 'admin')
    store = Store()
    query = request.get('query', {})
    if query.get('role') and query['role'] not in ('ADMIN', 'EDITOR', 'READER'):
        invalid('role')
    if query.get('status') and query['status'] not in ('ACTIVE', 'DISABLED', 'DELETED'):
        invalid('status')
    search = normalize(query.get('q', ''))
    items = []
    for entry in store.query_index('DIRECTORY#ACCOUNT'):
        item = store.get(entry['PK'])
        if not item or item.get('purgeAt', epoch() + 1) <= epoch():
            continue
        if search not in normalize(item['email']):
            continue
        if query.get('role') and item['role'] != query['role']:
            continue
        if query.get('status') and item['accountStatus'] != query['status']:
            continue
        items.append(item)
    items.sort(key=lambda i: (normalize(i['email']), i['cognitoSub']))
    return paginate([view(i) for i in items], query, 'accounts')


def create_account(request, principal):
    require_role(principal, 'admin')
    payload = validate_payload(request['body'])
    store, cognito = Store(), Cognito()
    if payload.get('catechistId'):
        get_profile(store, payload['catechistId'])
    username = None
    write_started = False
    try:
        response = cognito.call('admin_create_user', Username=payload['email'], MessageAction='SUPPRESS',
                                UserAttributes=[{'Name': 'email', 'Value': payload['email']},
                                                {'Name': 'email_verified', 'Value': 'true'}])
        user = response['User']
        username = user['Username']
        sub = next(a['Value'] for a in user['Attributes'] if a['Name'] == 'sub')
        cognito.call('admin_set_user_password', Username=username, Password=payload['password'], Permanent=True)
        cognito.call('admin_add_user_to_group', Username=username, GroupName=payload['role'].lower())
        stamp = now()
        item = {'PK': 'ACCOUNT#' + sub, 'SK': 'PROFILE', 'entityType': 'ACCOUNT', 'cognitoSub': sub,
                'cognitoUsername': username, 'email': payload['email'], 'role': payload['role'],
                'accountStatus': 'ACTIVE', 'version': 1, 'createdAt': stamp, 'updatedAt': stamp,
                'createdBy': principal['sub'], 'updatedBy': principal['sub'],
                'GSI1PK': 'DIRECTORY#ACCOUNT', 'GSI1SK': normalize(payload['email']) + '#' + sub}
        if payload.get('catechistId'):
            item['catechistId'] = payload['catechistId']
        writes = link_writes(store, None, item.get('catechistId'), sub, principal)
        write_started = True
        store.transact([{'put': item, 'create': True}] + writes)
        return view(item)
    except Exception:
        # A transport timeout can occur after DynamoDB commits. Strongly read the
        # generated key before compensation, so we never delete a committed user.
        if write_started:
            try:
                persisted = store.get(item['PK'])
            except Exception:
                log.error('Account creation outcome unknown requestId=%s username=%s',
                          request.get('request_id'), username)
                raise
            if persisted and persisted.get('cognitoUsername') == username:
                return view(persisted)
        if username:
            try:
                cognito.delete(username)
            except Exception:
                # Identifiers are sufficient for operations; never include exception/body/password.
                log.error('Account creation compensation failed requestId=%s username=%s',
                          request.get('request_id'), username)
        raise


def link_catechist(request, principal):
    require_role(principal, 'admin')
    fields(request['body'], {'catechistId'})
    new_id = text(request['body'], 'catechistId', 100)
    store = Store()
    old = account(store, request)
    protect(old)
    if old['role'] != 'EDITOR':
        invalid('catechistId')
    if old.get('pendingAction'):
        raise ApiError(409, 'VERSION_CONFLICT', 'Account operation in progress.')
    writes = link_writes(store, old, new_id, old['cognitoSub'], principal)
    item = touch(old, principal)
    item['catechistId'] = new_id
    store.transact([{'put': item, 'version': old['version']}] + writes)
    return view(item)


def reset_password(request, principal):
    require_role(principal, 'admin')
    fields(request['body'], {'password'})
    secret = password(request['body'])
    old = account(Store(), request)
    protect(old)
    if old.get('pendingAction'):
        raise ApiError(409, 'VERSION_CONFLICT', 'Account operation in progress.')
    Cognito().call('admin_set_user_password', Username=old.get('cognitoUsername', old['cognitoSub']),
                   Password=secret, Permanent=True)
    return {'cognitoSub': old['cognitoSub']}


def transition(request, principal, action, target):
    require_role(principal, 'admin')
    fields(request.get('body', {}), set())
    store, cognito = Store(), Cognito()
    old = account(store, request, deleted=action in ('archive', 'restore'))
    protect(old)
    if old.get('pendingAction') and old['pendingAction'] != action:
        raise ApiError(409, 'VERSION_CONFLICT', 'Finish the pending account operation first.')
    if old.get('pendingAction') and old.get('pendingUntil', 0) > epoch():
        raise ApiError(409, 'VERSION_CONFLICT', 'Account operation in progress; retry after its lease expires.')
    if not old.get('pendingAction'):
        if action == 'restore' and old['accountStatus'] != 'DELETED':
            return view(old)
        if old['accountStatus'] == target:
            return view(old)
        reserved = touch(old, principal)
        reserved.update(pendingAction=action, pendingStatus=target, pendingUntil=epoch() + 120, pendingToken=new_id('op'))
        if target != 'ACTIVE':
            reserved['tokenValidAfter'] = epoch()
        # Removing TTL while restoring prevents a concurrent TTL delete during Cognito enable.
        if action == 'restore':
            reserved.pop('purgeAt', None)
        store.put(reserved, expected_version=old['version'])
    else:
        reserved = touch(old, principal)
        reserved.update(pendingUntil=epoch() + 120, pendingToken=new_id('op'))
        store.put(reserved, expected_version=old['version'])
    operation = 'admin_enable_user' if target == 'ACTIVE' else 'admin_disable_user'
    # If Cognito or final persistence fails, retain the operation marker. Retrying the
    # same endpoint safely repeats the idempotent Cognito action; opposing actions conflict.
    cognito.call(operation, Username=reserved.get('cognitoUsername', reserved['cognitoSub']))
    latest = store.get(reserved['PK'])
    if not latest:
        raise ApiError(409, 'VERSION_CONFLICT', 'Account changed during operation.')
    if latest.get('pendingToken') != reserved['pendingToken']:
        if latest.get('accountStatus') == target:
            return view(latest)
        raise ApiError(409, 'VERSION_CONFLICT', 'Account changed during operation.')
    item = touch(latest, principal)
    item.pop('pendingAction', None)
    item.pop('pendingStatus', None)
    item.pop('pendingUntil', None)
    item.pop('pendingToken', None)
    item['accountStatus'] = target
    if target == 'DELETED':
        item.update(deletedAt=now(), purgeAt=epoch() + RETENTION)
    else:
        item.pop('deletedAt', None)
        item.pop('purgeAt', None)
    store.put(item, expected_version=latest['version'])
    return view(item)


def disable(request, principal):
    return transition(request, principal, 'disable', 'DISABLED')


def enable(request, principal):
    return transition(request, principal, 'enable', 'ACTIVE')


def archive(request, principal):
    return transition(request, principal, 'archive', 'DELETED')


def restore(request, principal):
    return transition(request, principal, 'restore', 'ACTIVE')
