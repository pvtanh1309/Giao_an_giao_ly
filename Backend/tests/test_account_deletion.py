"""Immediate Cognito deletion with durable retry and role/state guards."""
import pytest
from shared.errors import ApiError
from users_api.services import accounts
from users_api import stream
from test_users import env, reader_account, request, ttl_record, ADMIN, EDITOR, READER


@pytest.mark.parametrize('role', ['READER', 'EDITOR'])
def test_delete_disabled_account_removes_cognito_and_link_but_keeps_profile(env, role):
    store, cognito = env
    user = reader_account()
    req = request(cognitoSub=user['cognitoSub'])
    key = ('ACCOUNT#' + user['cognitoSub'], 'PROFILE')
    store.items[key]['role'] = role
    accounts.disable(req, ADMIN)
    accounts.delete_account(req, ADMIN)
    item = store.get(key[0])
    assert item['permanentlyDeleted'] and item['accountStatus'] == 'DELETED'
    assert not item.get('pendingAction') and not item.get('GSI1PK')
    assert ('admin_delete_user', {'Username': 'username-1'}) in cognito.calls
    assert store.get('CATECHIST#cat-reader') is not None
    assert store.get('CATECHIST#cat-reader', 'ACCOUNT#' + user['cognitoSub']) is None
    assert accounts.list_accounts(request(), ADMIN).items == []
    assert accounts.delete_account(req, ADMIN) == {'cognitoSub': user['cognitoSub']}
    with pytest.raises(ApiError):
        accounts.restore(req, ADMIN)


@pytest.mark.parametrize('principal', [EDITOR, READER])
def test_only_admin_can_delete(env, principal):
    with pytest.raises(ApiError) as error:
        accounts.delete_account(request(cognitoSub='anything'), principal)
    assert error.value.status == 403


def test_active_accounts_and_admin_targets_are_protected(env):
    store, cognito = env
    user = reader_account()
    req = request(cognitoSub=user['cognitoSub'])
    with pytest.raises(ApiError) as error:
        accounts.delete_account(req, ADMIN)
    assert error.value.code == 'ACCOUNT_MUST_BE_DISABLED'
    store.items[('ACCOUNT#' + user['cognitoSub'], 'PROFILE')].update(role='ADMIN', accountStatus='DISABLED')
    with pytest.raises(ApiError) as error:
        accounts.delete_account(req, ADMIN)
    assert error.value.code == 'LAST_ADMIN_PROTECTED'
    assert not any(op == 'admin_delete_user' for op, _ in cognito.calls)


@pytest.mark.parametrize('failure', ['cognito', 'finalize'])
def test_delete_failure_preserves_disabled_account_and_can_retry(env, failure):
    store, cognito = env
    user = reader_account()
    req = request(cognitoSub=user['cognitoSub'])
    accounts.disable(req, ADMIN)
    cognito.fail = 'admin_delete_user' if failure == 'cognito' else None
    store.fail_finalize = failure == 'finalize'
    with pytest.raises(RuntimeError):
        accounts.delete_account(req, ADMIN)
    pending = store.items[('ACCOUNT#' + user['cognitoSub'], 'PROFILE')]
    assert pending['pendingAction'] == 'delete' and pending['accountStatus'] == 'DISABLED'
    with pytest.raises(ApiError):
        accounts.enable(req, ADMIN)
    with pytest.raises(ApiError):
        accounts.delete_account(req, ADMIN)
    pending['pendingUntil'] = 0
    cognito.fail = None
    store.fail_finalize = False
    accounts.delete_account(req, ADMIN)
    assert store.get(pending['PK'])['permanentlyDeleted']


def test_permanent_ttl_cleanup_removes_notes_without_deleting_cognito_again(env):
    store, cognito = env
    item = {'PK': 'ACCOUNT#old', 'SK': 'PROFILE', 'entityType': 'ACCOUNT',
            'cognitoSub': 'old', 'accountStatus': 'DELETED', 'role': 'READER',
            'permanentlyDeleted': True, 'purgeAt': 1, 'cognitoUsername': 'reused@example.com'}
    store.items[(item['PK'], 'LESSONNOTE#lesson#note')] = {
        'PK': item['PK'], 'SK': 'LESSONNOTE#lesson#note', 'version': 1}
    assert stream.handle_stream({'Records': [ttl_record(item)]}, None) == {'batchItemFailures': []}
    assert store.query(item['PK']) == []
    assert cognito.calls == []
