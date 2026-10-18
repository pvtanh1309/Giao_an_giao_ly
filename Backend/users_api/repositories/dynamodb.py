"""Shared DynamoDB adapter and atomic profile/account link helpers."""
from shared.db import Store
from shared.errors import ApiError
from shared.models import now, epoch

RETENTION = 10 * 86400
MAX_LINKS = 45


def require_role(principal, *roles):
    if not principal.get('sub'):
        raise ApiError(401, 'UNAUTHORIZED', 'Authentication required.')
    if not set(principal.get('groups', ())).intersection(roles):
        raise ApiError(403, 'FORBIDDEN', 'Insufficient permissions.')


def get_profile(store, identifier, deleted=False):
    item = store.get('CATECHIST#' + identifier)
    if not item or (item.get('deletedAt') and not deleted) or item.get('purgeAt', epoch() + 1) <= epoch():
        raise ApiError(404, 'NOT_FOUND', 'Profile not found.')
    return item


def touch(item, principal):
    return {**item, 'version': item['version'] + 1, 'updatedAt': now(), 'updatedBy': principal['sub']}


def link_item(profile_id, sub):
    return {'PK': 'CATECHIST#' + profile_id, 'SK': 'ACCOUNT#' + sub, 'entityType': 'ACCOUNT_LINK', 'cognitoSub': sub}


def ensure_unique_profile(store, profile, sub):
    for link in store.query(profile['PK']):
        other_sub = link.get('cognitoSub')
        if not link['SK'].startswith('ACCOUNT#') or not other_sub or other_sub == sub:
            continue
        other = store.get('ACCOUNT#' + other_sub)
        if (other and other.get('catechistId') == profile['catechistId']
                and (other.get('accountStatus') != 'DELETED' or other.get('pendingAction') == 'restore')):
            raise ApiError(409, 'PROFILE_ALREADY_LINKED', 'Hồ sơ đã liên kết với tài khoản khác. Liên hệ Admin để xử lý.')


def status_profile_writes(store, account, principal, target):
    identifier = account.get('catechistId')
    if not identifier:
        return []
    profile = store.get('CATECHIST#' + identifier)
    if not profile or profile.get('deletedAt'):
        return []
    if target != 'DELETED':
        ensure_unique_profile(store, profile, account['cognitoSub'])
    return [{'put': touch(profile, principal), 'version': profile['version']}]


def link_writes(store, old, new_id, sub, principal):
    """Bump profiles so archive cannot miss concurrent link changes."""
    writes = []
    old_id = (old or {}).get('catechistId')
    if old_id and old_id != new_id:
        previous = store.get('CATECHIST#' + old_id)
        if previous:
            writes.append({'put': touch(previous, principal), 'version': previous['version']})
        writes.append({'delete': {'PK': 'CATECHIST#' + old_id, 'SK': 'ACCOUNT#' + sub}})
    if new_id:
        profile = get_profile(store, new_id)
        ensure_unique_profile(store, profile, sub)
        links = [item for item in store.query(profile['PK']) if item['SK'].startswith('ACCOUNT#')]
        if len(links) >= MAX_LINKS and old_id != new_id:
            raise ApiError(409, 'VERSION_CONFLICT', 'Profile account link limit reached.')
        writes.extend([{'put': touch(profile, principal), 'version': profile['version']},
                       {'put': link_item(new_id, sub)}])
    return writes
