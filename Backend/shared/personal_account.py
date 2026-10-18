from shared.errors import ApiError
from shared.models import epoch


def own_account(store, principal):
    if not principal.get('sub'):
        raise ApiError(401, 'UNAUTHORIZED', 'Cần đăng nhập.')
    account = store.get('ACCOUNT#' + principal['sub'])
    if (not account or account.get('accountStatus') != 'ACTIVE' or account.get('pendingAction')
            or account.get('purgeAt', epoch() + 1) <= epoch()
            or account.get('role', '').lower() not in principal.get('groups', ())):
        raise ApiError(403, 'FORBIDDEN', 'Tài khoản hiện không hoạt động.')
    return account
