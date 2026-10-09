"""User lifecycle tests use an atomic in-memory DB and an isolated Cognito fake."""
from copy import deepcopy
import pytest

from shared.errors import ApiError
from users_api.services import accounts, catechists
from users_api import stream
from users_api.validators.accounts import validate_payload

ADMIN = {'sub': 'admin-1', 'groups': ('admin',)}
EDITOR = {'sub': 'editor-1', 'groups': ('editor',)}
READER = {'sub': 'reader-1', 'groups': ('reader',)}


def request(body=None, **path):
    return {'body': body or {}, 'path_parameters': path, 'query': {}, 'request_id': 'test-request'}


class MemoryStore:
    def __init__(self):
        self.items = {}
        self.fail_transaction = False
        self.before_transaction = None
        self.fail_finalize = False

    def get(self, pk, sk='PROFILE'):
        return deepcopy(self.items.get((pk, sk)))

    def query(self, pk):
        return [deepcopy(item) for (key, _), item in self.items.items() if key == pk]

    def query_index(self, partition):
        return [deepcopy(item) for item in self.items.values() if item.get('GSI1PK') == partition]

    def put(self, item, expected_version=None, create=False):
        if self.fail_finalize and item.get('entityType') == 'ACCOUNT' and not item.get('pendingAction'):
            raise RuntimeError('Persistence unavailable')
        self.transact([{'put': item, 'version': expected_version, 'create': create}])

    def delete(self, pk, sk='PROFILE', expected_version=None):
        self.transact([{'delete': {'PK': pk, 'SK': sk}, 'version': expected_version}])

    def transact(self, writes):
        if self.before_transaction:
            callback, self.before_transaction = self.before_transaction, None
            callback()
        if self.fail_transaction:
            raise RuntimeError('Transaction unavailable')
        for write in writes:
            item = write.get('put') or write.get('delete') or write.get('check')
            old = self.items.get((item['PK'], item['SK']))
            if (write.get('create') and old is not None) or (
                    write.get('version') is not None and (old or {}).get('version') != write['version']):
                raise ApiError(409, 'VERSION_CONFLICT', 'Changed.')
        changed = deepcopy(self.items)
        for write in writes:
            item = write.get('put') or write.get('delete') or write.get('check')
            key = (item['PK'], item['SK'])
            if 'put' in write:
                changed[key] = deepcopy(item)
            elif 'delete' in write:
                changed.pop(key, None)
        self.items = changed


class FakeCognito:
    def __init__(self):
        self.calls = []
        self.fail = None
        self.next_sub = 0

    def call(self, operation, **kwargs):
        self.calls.append((operation, kwargs))
        if operation == self.fail:
            raise RuntimeError('Cognito unavailable')
        if operation == 'admin_create_user':
            self.next_sub += 1
            return {'User': {'Username': 'username-' + str(self.next_sub),
                             'Attributes': [{'Name': 'sub', 'Value': 'sub-' + str(self.next_sub)}]}}
        return {}

    def delete(self, username):
        return self.call('admin_delete_user', Username=username)


@pytest.fixture
def env(monkeypatch):
    store, cognito = MemoryStore(), FakeCognito()
    for module in (accounts, catechists, stream):
        monkeypatch.setattr(module, 'Store', lambda: store)
    for module in (accounts, stream):
        monkeypatch.setattr(module, 'Cognito', lambda: cognito)
    return store, cognito


def profile():
    return catechists.create_profile(request({'name': 'Maria Nguyễn Lan', 'email': 'lan@example.com',
                                             'phone': '0901234567', 'group': 'Ấu Nhi'}), EDITOR)


def reader_account():
    return accounts.create_account(request({'email': 'reader@example.com', 'password': 'Password!123',
                                             'role': 'READER'}), ADMIN)


def editor_account(profile_id):
    return accounts.create_account(request({'email': 'editor@example.com', 'password': 'Password!123',
                                             'role': 'EDITOR', 'catechistId': profile_id}), ADMIN)


@pytest.mark.parametrize('body', [
    {'email': 'a@b.com', 'password': 'Password!123', 'role': 'ADMIN'},
    {'email': 'a@b.com', 'password': 'Password!123', 'role': 'EDITOR'},
    {'email': 'a@b.com', 'password': 'Password!123', 'role': 'READER', 'catechistId': 'cat-1'},
    {'email': 'bad', 'password': 'Password!123', 'role': 'READER'},
    {'email': 'a@b.com', 'password': 'Password!123', 'role': 'READER', 'createdBy': 'attacker'},
])
def test_invalid_account_inputs(body):
    with pytest.raises(ApiError):
        validate_payload(body)


def test_services_enforce_roles_without_router(env):
    with pytest.raises(ApiError):
        catechists.create_profile(request({}), READER)
    with pytest.raises(ApiError):
        accounts.list_accounts(request(), EDITOR)


def test_creation_suppresses_email_sets_permanent_password_and_never_persists_secret(env):
    store, cognito = env
    result = reader_account()
    assert result['role'] == 'READER'
    assert len(store.items) == 1
    assert 'Password!123' not in repr(store.items)
    assert 'cognitoUsername' not in result
    assert cognito.calls[0][1]['MessageAction'] == 'SUPPRESS'
    assert cognito.calls[1][1]['Permanent'] is True
    assert cognito.calls[2][1]['GroupName'] == 'reader'


@pytest.mark.parametrize('stage', ['admin_set_user_password', 'admin_add_user_to_group', 'database'])
def test_create_compensates_every_post_creation_failure(env, stage):
    store, cognito = env
    if stage == 'database':
        store.fail_transaction = True
    else:
        cognito.fail = stage
    with pytest.raises(RuntimeError):
        reader_account()
    assert cognito.calls[-1] == ('admin_delete_user', {'Username': 'username-1'})
    assert not store.items


def test_profile_archive_unlinks_all_accounts_without_cognito_changes(env):
    store, cognito = env
    created = profile()
    first = editor_account(created['catechistId'])
    second = editor_account(created['catechistId'])
    previous_calls = len(cognito.calls)
    deleted = catechists.archive_profile(request(catechistId=created['catechistId']), EDITOR)
    assert deleted['purgeAt'] > catechists.epoch()
    for result in (first, second):
        item = store.get('ACCOUNT#' + result['cognitoSub'])
        assert 'catechistId' not in item
        assert item['accountStatus'] == 'ACTIVE'
    assert len(cognito.calls) == previous_calls
    assert len(store.query('CATECHIST#' + created['catechistId'])) == 1
    restored = catechists.restore_profile(request(catechistId=created['catechistId']), EDITOR)
    assert 'purgeAt' not in restored
    assert 'catechistId' not in store.get('ACCOUNT#' + first['cognitoSub'])


def test_archive_rejects_link_race_without_partial_unlink(env):
    store, _ = env
    created = profile()
    linked = editor_account(created['catechistId'])
    def race():
        store.items[('CATECHIST#' + created['catechistId'], 'PROFILE')]['version'] += 1
    store.before_transaction = race
    with pytest.raises(ApiError):
        catechists.archive_profile(request(catechistId=created['catechistId']), EDITOR)
    assert store.get('ACCOUNT#' + linked['cognitoSub'])['catechistId'] == created['catechistId']
    assert 'deletedAt' not in store.get('CATECHIST#' + created['catechistId'])


def test_relink_moves_reverse_reference_and_rejects_stale_profile_version(env):
    store, _ = env
    first, second = profile(), profile()
    linked = editor_account(first['catechistId'])
    result = accounts.link_catechist(request({'catechistId': second['catechistId']}, cognitoSub=linked['cognitoSub']), ADMIN)
    assert result['catechistId'] == second['catechistId']
    assert store.get('CATECHIST#' + first['catechistId'], 'ACCOUNT#' + linked['cognitoSub']) is None
    assert store.get('CATECHIST#' + second['catechistId'], 'ACCOUNT#' + linked['cognitoSub'])
    with pytest.raises(ApiError):
        catechists.update_profile(request({'name': 'Changed', 'email': 'a@b.com', 'version': 1},
                                          catechistId=first['catechistId']), EDITOR)


def test_account_archive_restore_and_password_reset(env):
    store, cognito = env
    created = reader_account()
    req = request(cognitoSub=created['cognitoSub'])
    assert accounts.disable(req, ADMIN)['accountStatus'] == 'DISABLED'
    assert accounts.enable(req, ADMIN)['accountStatus'] == 'ACTIVE'
    accounts.reset_password(request({'password': 'Replacement!123'}, cognitoSub=created['cognitoSub']), ADMIN)
    assert cognito.calls[-1][0] == 'admin_set_user_password'
    assert 'Replacement!123' not in repr(store.items)
    deleted = accounts.archive(req, ADMIN)
    assert deleted['accountStatus'] == 'DELETED'
    assert deleted['purgeAt'] > accounts.epoch()
    restored = accounts.restore(req, ADMIN)
    assert restored['accountStatus'] == 'ACTIVE'
    assert 'purgeAt' not in restored


def test_pending_transition_blocks_opposite_action_and_recovers_after_lease(env):
    store, cognito = env
    created = reader_account()
    req = request(cognitoSub=created['cognitoSub'])
    cognito.fail = 'admin_disable_user'
    with pytest.raises(RuntimeError):
        accounts.disable(req, ADMIN)
    cognito.fail = None
    with pytest.raises(ApiError):
        accounts.enable(req, ADMIN)
    with pytest.raises(ApiError):
        accounts.disable(req, ADMIN)
    store.items[('ACCOUNT#' + created['cognitoSub'], 'PROFILE')]['pendingUntil'] = 0
    assert accounts.disable(req, ADMIN)['accountStatus'] == 'DISABLED'


def test_final_write_failure_is_retryable_and_hides_internal_state(env):
    store, _ = env
    created = reader_account()
    req = request(cognitoSub=created['cognitoSub'])
    store.fail_finalize = True
    with pytest.raises(RuntimeError):
        accounts.archive(req, ADMIN)
    pending = store.get('ACCOUNT#' + created['cognitoSub'])
    assert pending['pendingAction'] == 'archive'
    assert 'pendingToken' not in accounts.view(pending)
    store.fail_finalize = False
    store.items[(pending['PK'], 'PROFILE')]['pendingUntil'] = 0
    assert accounts.archive(req, ADMIN)['accountStatus'] == 'DELETED'


@pytest.mark.parametrize('operation', [accounts.disable, accounts.enable, accounts.archive,
                                      accounts.restore, accounts.reset_password])
def test_admin_accounts_protected(env, operation):
    store, cognito = env
    created = reader_account()
    store.items[('ACCOUNT#' + created['cognitoSub'], 'PROFILE')]['role'] = 'ADMIN'
    before = len(cognito.calls)
    with pytest.raises(ApiError):
        operation(request({'password': 'Password!123'} if operation == accounts.reset_password else None,
                          cognitoSub=created['cognitoSub']), ADMIN)
    assert len(cognito.calls) == before


def ttl_record(item, sequence='123'):
    from boto3.dynamodb.types import TypeSerializer
    serializer = TypeSerializer()
    return {'eventSource': 'aws:dynamodb', 'eventName': 'REMOVE',
            'userIdentity': {'type': 'Service', 'principalId': 'dynamodb.amazonaws.com'},
            'dynamodb': {'SequenceNumber': sequence,
                         'OldImage': {key: serializer.serialize(value) for key, value in item.items()}}}


def test_stream_ignores_stale_restore_and_non_ttl_then_deletes_expired_account(env):
    store, cognito = env
    created = reader_account()
    deleted = accounts.archive(request(cognitoSub=created['cognitoSub']), ADMIN)
    item = store.get('ACCOUNT#' + created['cognitoSub'])
    item['purgeAt'] = 1
    record = ttl_record(item)
    before = len(cognito.calls)
    assert stream.handle_stream({'Records': [record]}, None) == {'batchItemFailures': []}
    assert len(cognito.calls) == before
    store.delete(item['PK'])
    ordinary = deepcopy(record)
    ordinary.pop('userIdentity')
    stream.handle_stream({'Records': [ordinary]}, None)
    assert len(cognito.calls) == before
    assert stream.handle_stream({'Records': [record]}, None) == {'batchItemFailures': []}
    assert cognito.calls[-1] == ('admin_delete_user', {'Username': 'username-1'})


def test_stream_returns_sequence_number_for_failed_cleanup(env):
    _, cognito = env
    cognito.fail = 'admin_delete_user'
    item = {'PK': 'ACCOUNT#sub', 'SK': 'PROFILE', 'entityType': 'ACCOUNT', 'cognitoSub': 'sub',
            'accountStatus': 'DELETED', 'role': 'READER', 'purgeAt': 1}
    assert stream.handle_stream({'Records': [ttl_record(item, '456')]}, None) == {
        'batchItemFailures': [{'itemIdentifier': '456'}]}


def test_cognito_duplicate_mapping_and_delete_idempotency():
    from botocore.exceptions import ClientError
    from users_api.repositories.cognito import Cognito
    class Client:
        def admin_create_user(self, **kwargs):
            raise ClientError({'Error': {'Code': 'UsernameExistsException'}}, 'AdminCreateUser')
        def admin_delete_user(self, **kwargs):
            raise ClientError({'Error': {'Code': 'UserNotFoundException'}}, 'AdminDeleteUser')
    repo = Cognito(Client(), 'pool')
    with pytest.raises(ApiError):
        repo.call('admin_create_user', Username='duplicate@example.com')
    assert repo.delete('gone') == {}


def test_lists_filter_normalized_names_roles_statuses_and_page(env):
    created = profile()
    linked = editor_account(created['catechistId'])
    reader_account()
    req = request()
    req['query'] = {'q': 'nguyen'}
    page = catechists.list_profiles(req, READER)
    assert [i['catechistId'] for i in page.items] == [created['catechistId']]
    req['query'] = {'role': 'EDITOR', 'status': 'ACTIVE'}
    assert [i['cognitoSub'] for i in accounts.list_accounts(req, ADMIN).items] == [linked['cognitoSub']]
    catechists.archive_profile(request(catechistId=created['catechistId']), EDITOR)
    assert catechists.list_profiles(request(), READER).items == []


def test_profile_update_and_expired_restore(env):
    store, _ = env
    created = profile()
    updated = catechists.update_profile(request({'name': 'New name', 'email': 'new@example.com',
                                                 'version': created['version'], 'status': 'PAUSED'},
                                                catechistId=created['catechistId']), EDITOR)
    assert updated['version'] == 2
    assert updated['status'] == 'PAUSED'
    catechists.archive_profile(request(catechistId=created['catechistId']), EDITOR)
    store.items[('CATECHIST#' + created['catechistId'], 'PROFILE')]['purgeAt'] = 1
    with pytest.raises(ApiError):
        catechists.restore_profile(request(catechistId=created['catechistId']), EDITOR)


def test_missing_editor_profile_never_creates_cognito_user(env):
    _, cognito = env
    with pytest.raises(ApiError):
        editor_account('cat-missing')
    assert cognito.calls == []


def test_create_does_not_compensate_a_transaction_that_committed_before_timeout(env):
    store, cognito = env
    original = store.transact
    def commit_then_timeout(writes):
        original(writes)
        raise TimeoutError('Response lost')
    store.transact = commit_then_timeout
    result = reader_account()
    assert result['accountStatus'] == 'ACTIVE'
    assert not any(operation == 'admin_delete_user' for operation, _ in cognito.calls)


def test_http_boundary_enforces_group_and_serializes_safe_creation(env, monkeypatch):
    import json
    from users_api.handler import lambda_handler
    store, _ = env
    store.items['ACCOUNT#admin-1', 'PROFILE'] = {'accountStatus': 'ACTIVE', 'role': 'ADMIN'}
    monkeypatch.setattr('shared.db.Store', lambda: store)
    event = {'routeKey': 'POST /admin/accounts', 'requestContext': {'requestId': 'http-test',
             'authorizer': {'jwt': {'claims': {'sub': 'admin-1', 'cognito:groups': ['admin'],
                                               'token_use': 'access'}}}},
             'body': json.dumps({'email': 'reader@example.com', 'password': 'Password!123', 'role': 'READER'})}
    response = lambda_handler(event, None)
    assert response['statusCode'] == 201
    body = json.loads(response['body'])
    assert body['meta']['requestId'] == 'http-test'
    assert 'Password!123' not in response['body']
    event['requestContext']['authorizer']['jwt']['claims']['cognito:groups'] = ['editor']
    assert lambda_handler(event, None)['statusCode'] == 403


def test_editor_can_discover_archived_profiles_after_reload(env):
    created = profile()
    catechists.archive_profile(request(catechistId=created['catechistId']), EDITOR)
    assert catechists.list_profiles(request(), READER).items == []
    req = request()
    req['query'] = {'includeDeleted': 'true'}
    trash = catechists.list_management(req, EDITOR).items
    assert trash[0]['catechistId'] == created['catechistId']
    with pytest.raises(ApiError):
        catechists.list_management(request(), READER)
