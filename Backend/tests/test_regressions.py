from content_api.services.content import Content
from content_api.repositories.s3_media import MediaObjects
from shared.auth import require_active_account
from shared.errors import ApiError
from unittest.mock import Mock
import pytest
from shared.tiptap_validator import validate_document


def test_content_read_uses_atomic_snapshot_not_query():
    class SnapshotStore:
        def query(self, pk):
            raise AssertionError("Query can mix revisions across a concurrent transaction")

        def transact_get(self, keys):
            assert {key['SK'] for key in keys} == {'META', 'DRAFT', 'PUBLISHED'}
            return [{'PK': 'LESSON#id', 'SK': 'META', 'version': 3, 'status': 'ACTIVE'},
                    {'PK': 'LESSON#id', 'SK': 'DRAFT', 'version': 3, 'title': 'latest'}]

    items = Content('LESSON', SnapshotStore()).load({'path_parameters': {'lessonId': 'id'}})
    assert items['DRAFT']['version'] == items['META']['version'] == 3


def test_presigned_upload_uses_regional_sigv4(monkeypatch):
    monkeypatch.setenv('AWS_DEFAULT_REGION', 'ap-southeast-1')
    objects = MediaObjects(bucket='example-bucket')
    url = objects.upload_url({'objectKey': 'lesson-media/id/media_id', 'mimeType': 'image/jpeg'})
    assert 'X-Amz-Algorithm=AWS4-HMAC-SHA256' in url
    assert '.s3.ap-southeast-1.amazonaws.com/' in url


@pytest.mark.parametrize('status,pending', [('DISABLED', None), ('DELETED', None), ('ACTIVE', 'disable'), ('ACTIVE', 'archive')])
def test_disabled_account_cannot_use_existing_jwt(monkeypatch, status, pending):
    monkeypatch.setenv('TABLE_NAME', 'test')
    monkeypatch.setattr('shared.db.Store', Mock(return_value=Mock(get=Mock(return_value={
        'accountStatus': status, 'pendingAction': pending, 'role': 'EDITOR'}))))
    with pytest.raises(ApiError) as failure:
        require_active_account({'sub': 'editor', 'groups': ('editor',)}, {})
    assert failure.value.status == 403


def test_reenabled_account_rejects_pre_disable_token(monkeypatch):
    monkeypatch.setenv('TABLE_NAME', 'test')
    monkeypatch.setattr('shared.db.Store', Mock(return_value=Mock(get=Mock(return_value={
        'accountStatus': 'ACTIVE', 'role': 'EDITOR', 'tokenValidAfter': 100}))))
    with pytest.raises(ApiError) as failure:
        require_active_account({'sub': 'editor', 'groups': ('editor',)}, {'requestContext': {'authorizer': {'jwt': {'claims': {'iat': '99'}}}}})
    assert failure.value.status == 401


@pytest.mark.parametrize('node', [
    {'type': []},
    {'type': 'paragraph', 'attrs': {'textAlign': []}},
    {'type': 'paragraph', 'content': [{'type': 'text', 'text': 'x', 'marks': [{'type': []}]}]},
])
def test_malformed_tiptap_types_are_validation_errors(node):
    with pytest.raises(ApiError) as failure:
        validate_document({'type': 'doc', 'content': [node]})
    assert failure.value.status == 400
