from copy import deepcopy
import pytest
from shared.errors import ApiError
from content_api.services import lesson_notes
from content_api.services.note_anchors import make_anchor
from test_users import MemoryStore, request

A = {'sub': 'a', 'groups': ('reader',)}
B = {'sub': 'b', 'groups': ('admin',)}
NOTE = 'aabbccdd-0000-4000-8000-000000000001'
class NotesStore(MemoryStore):
    def transact_get(self, keys):
        return [x for key in keys if (x := self.get(key['PK'], key['SK']))]
    def query_prefix(self, pk, prefix):
        return [x for x in self.query(pk) if x['SK'].startswith(prefix)]

@pytest.fixture
def notes(monkeypatch):
    store = NotesStore()
    for sub, role in [('a', 'READER'), ('b', 'ADMIN')]:
        store.items[('ACCOUNT#' + sub, 'PROFILE')] = {'PK': 'ACCOUNT#' + sub, 'SK': 'PROFILE', 'cognitoSub': sub, 'accountStatus': 'ACTIVE', 'role': role, 'version': 1}
    for sk in ['META', 'PUBLISHED']:
        store.items[('LESSON#lesson_a', sk)] = {'PK': 'LESSON#lesson_a', 'SK': sk, 'lessonId': 'lesson_a', 'version': 2, 'status': 'ACTIVE', 'scriptureText': 'Lời Chúa cho con'}
    monkeypatch.setattr(lesson_notes, 'Store', lambda: store)
    return store

def req(body=None, note=NOTE):
    return request(body, lessonId='lesson_a', noteId=note)
def payload(note=NOTE):
    return {'noteId': note, 'anchor': make_anchor('scripture', 'Lời Chúa cho con', 0, 8), 'body': 'Ghi chú riêng'}

def test_private_crud_idempotency_and_no_lesson_mutation(notes):
    before = deepcopy(notes.query('LESSON#lesson_a'))
    first = lesson_notes.create(req(payload()), A)
    assert lesson_notes.create(req(payload()), A) == first
    assert len(lesson_notes.list_notes(req(), A)) == 1
    assert lesson_notes.list_notes(req(), B) == []
    with pytest.raises(ApiError) as error:
        lesson_notes.update(req({'body': 'steal', 'version': 1}), B)
    assert error.value.status == 404
    updated = lesson_notes.update(req({'body': 'Đổi nội dung', 'version': 1}), A)
    assert updated['version'] == 2
    with pytest.raises(ApiError):
        lesson_notes.update(req({'body': 'stale', 'version': 1}), A)
    assert notes.query('LESSON#lesson_a') == before
    lesson_notes.remove(req({'version': 2}), A)
    lesson_notes.remove(req({'version': 2}), A)
    assert lesson_notes.list_notes(req(), A) == []

def test_quota_and_retry_of_last_note(notes):
    notes.items[('ACCOUNT#a', 'LESSONNOTECOUNT#lesson_a')] = {'PK': 'ACCOUNT#a', 'SK': 'LESSONNOTECOUNT#lesson_a', 'count': 99, 'version': 4}
    lesson_notes.create(req(payload()), A)
    assert lesson_notes.create(req(payload()), A)['version'] == 1
    with pytest.raises(ApiError) as error:
        lesson_notes.create(req(payload('aabbccdd-0000-4000-8000-000000000002')), A)
    assert error.value.status == 409
    assert notes.get('ACCOUNT#a', 'LESSONNOTECOUNT#lesson_a')['count'] == 100

@pytest.mark.parametrize('extra', [{'sub': 'b'}, {'owner': 'b'}])
def test_rejects_owner_spoofing(notes, extra):
    with pytest.raises(ApiError) as error:
        lesson_notes.create(req({**payload(), **extra}), A)
    assert error.value.status == 400

def test_disabled_and_unpublished_notes_blocked(notes):
    notes.items[('ACCOUNT#a', 'PROFILE')]['accountStatus'] = 'DISABLED'
    with pytest.raises(ApiError):
        lesson_notes.list_notes(req(), A)
    notes.items[('ACCOUNT#a', 'PROFILE')]['accountStatus'] = 'ACTIVE'
    del notes.items[('LESSON#lesson_a', 'PUBLISHED')]
    with pytest.raises(ApiError):
        lesson_notes.create(req(payload()), A)


def test_concurrent_last_quota_slot_cannot_exceed_limit(notes):
    key = ('ACCOUNT#a', 'LESSONNOTECOUNT#lesson_a')
    notes.items[key] = {'PK': key[0], 'SK': key[1], 'count': 99, 'version': 4}
    notes.before_transaction = lambda: notes.items[key].update(count=100, version=5)
    with pytest.raises(ApiError) as error:
        lesson_notes.create(req(payload()), A)
    assert error.value.code == 'NOTE_LIMIT'
    assert notes.get(*key)['count'] == 100
    assert notes.query_prefix('ACCOUNT#a', 'LESSONNOTE#') == []


def test_account_disable_during_create_is_guarded(notes):
    notes.before_transaction = lambda: notes.items[('ACCOUNT#a', 'PROFILE')].update(accountStatus='DISABLED', version=2)
    with pytest.raises(ApiError) as error:
        lesson_notes.create(req(payload()), A)
    assert error.value.status == 409
    assert notes.query_prefix('ACCOUNT#a', 'LESSONNOTE#') == []


def test_republish_during_create_is_guarded(notes):
    notes.before_transaction = lambda: notes.items[('LESSON#lesson_a', 'META')].update(version=3)
    with pytest.raises(ApiError) as error:
        lesson_notes.create(req(payload()), A)
    assert error.value.status == 409
    assert notes.query_prefix('ACCOUNT#a', 'LESSONNOTE#') == []


def test_owner_can_delete_note_after_lesson_is_gone(notes):
    lesson_notes.create(req(payload()), A)
    del notes.items[('LESSON#lesson_a', 'META')]
    del notes.items[('LESSON#lesson_a', 'PUBLISHED')]
    lesson_notes.remove(req({'version': 1}), A)
    assert notes.query_prefix('ACCOUNT#a', 'LESSONNOTE#') == []
