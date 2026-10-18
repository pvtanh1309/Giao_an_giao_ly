from copy import deepcopy
import pytest
from shared.errors import ApiError
from users_api.services import me, accounts
from test_users import MemoryStore, FakeCognito, request, ADMIN

READER = {'sub': 'person-a', 'groups': ('reader',)}

@pytest.fixture
def personal(monkeypatch):
    store = MemoryStore()
    profile = {'PK': 'CATECHIST#cat-a', 'SK': 'PROFILE', 'entityType': 'CATECHIST',
               'catechistId': 'cat-a', 'name': 'Maria Lan', 'email': 'contact@example.com',
               'phone': '', 'group': 'Ấu 1', 'status': 'ACTIVE', 'version': 2}
    account = {'PK': 'ACCOUNT#person-a', 'SK': 'PROFILE', 'entityType': 'ACCOUNT', 'cognitoSub': 'person-a',
               'email': 'login@example.com', 'catechistId': 'cat-a', 'role': 'READER', 'accountStatus': 'ACTIVE', 'version': 1}
    for item in (profile, account, {'PK': profile['PK'], 'SK': 'ACCOUNT#person-a', 'cognitoSub': 'person-a'}):
        store.items[(item['PK'], item['SK'])] = deepcopy(item)
    monkeypatch.setattr(me, 'Store', lambda: store)
    monkeypatch.setattr(accounts, 'Store', lambda: store)
    monkeypatch.setattr(accounts, 'Cognito', FakeCognito)
    return store

def payload():
    return {'email': 'new-contact@example.com', 'phone': '0901234567', 'group': 'Thiếu 1', 'accompanyingClass': 'Ấu 2', 'version': 2}

def test_updates_only_own_contact_profile_not_login(personal):
    result = me.update_profile(request(payload()), READER)
    assert result['displayName'] == 'Maria Lan'
    assert result['profile']['email'] == 'new-contact@example.com'
    assert result['profile']['version'] == 3
    assert personal.get('ACCOUNT#person-a')['email'] == 'login@example.com'
    assert result['loginEmail'] == 'login@example.com'

@pytest.mark.parametrize('extra', [{'catechistId': 'cat-b'}, {'sub': 'victim'}, {'role': 'ADMIN'}, {'name': 'Fake'}])
def test_cannot_choose_another_identity_or_change_role(personal, extra):
    with pytest.raises(ApiError) as error:
        me.update_profile(request({**payload(), **extra}), READER)
    assert error.value.status == 400

def test_account_relink_race_blocks_self_update(personal):
    def race():
        personal.items[('ACCOUNT#person-a', 'PROFILE')]['version'] += 1
    personal.before_transaction = race
    with pytest.raises(ApiError) as error:
        me.update_profile(request(payload()), READER)
    assert error.value.status == 409
    assert personal.get('CATECHIST#cat-a')['email'] == 'contact@example.com'

def test_unlinked_legacy_reader_can_read_me(personal):
    personal.items[('ACCOUNT#person-a', 'PROFILE')].pop('catechistId')
    assert me.get_me(request(), READER)['profile'] is None
    with pytest.raises(ApiError):
        me.update_profile(request(payload()), READER)

def test_disabled_account_cannot_use_me(personal):
    personal.items[('ACCOUNT#person-a', 'PROFILE')]['accountStatus'] = 'DISABLED'
    with pytest.raises(ApiError) as error:
        me.get_me(request(), READER)
    assert error.value.status == 403

def test_reader_cannot_link_profile_already_owned(personal):
    with pytest.raises(ApiError) as error:
        accounts.create_account(request({'email': 'another@example.com', 'password': 'Password!123',
                                          'role': 'READER', 'catechistId': 'cat-a'}), ADMIN)
    assert error.value.status == 409

def test_legacy_duplicate_profile_cannot_self_update(personal):
    personal.items[('CATECHIST#cat-a', 'ACCOUNT#other')] = {'PK': 'CATECHIST#cat-a', 'SK': 'ACCOUNT#other', 'cognitoSub': 'other'}
    personal.items[('ACCOUNT#other', 'PROFILE')] = {**personal.get('ACCOUNT#person-a'), 'PK': 'ACCOUNT#other', 'cognitoSub': 'other'}
    with pytest.raises(ApiError) as error:
        me.update_profile(request(payload()), READER)
    assert error.value.status == 409
