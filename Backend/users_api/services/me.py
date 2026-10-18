from shared.errors import ApiError
from shared.models import public
from users_api.repositories.dynamodb import Store, get_profile, touch, ensure_unique_profile
from users_api.validators.me import validate_profile
from shared.personal_account import own_account


def result(account, profile):
    return {'cognitoSub': account['cognitoSub'], 'loginEmail': account['email'],
            'displayName': profile['name'] if profile else account['email'],
            'profile': public(profile) if profile else None}


def get_me(request, principal):
    store = Store()
    account = own_account(store, principal)
    profile = None
    if account.get('catechistId'):
        try:
            profile = get_profile(store, account['catechistId'])
        except ApiError as error:
            if error.status != 404:
                raise
    return result(account, profile)


def update_profile(request, principal):
    payload = validate_profile(request['body'])
    store = Store()
    account = own_account(store, principal)
    if not account.get('catechistId'):
        raise ApiError(409, 'PROFILE_NOT_LINKED', 'Liên hệ Admin để liên kết hồ sơ giáo lý viên.')
    profile = get_profile(store, account['catechistId'])
    ensure_unique_profile(store, profile, principal['sub'])
    if profile['version'] != payload['version']:
        raise ApiError(409, 'VERSION_CONFLICT', 'Hồ sơ đã thay đổi. Hãy tải lại thông tin.')
    updated = touch({**profile, **payload}, principal)
    store.transact([
        {'check': {'PK': account['PK'], 'SK': 'PROFILE'}, 'version': account['version']},
        {'put': updated, 'version': profile['version']},
    ])
    return result(account, updated)
