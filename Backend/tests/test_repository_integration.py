"""Exercise real boto3 adapters against moto; no network or real AWS resources."""
import boto3
import pytest
from moto import mock_aws
from shared.db import Store
from shared.errors import ApiError
from content_api.services.content import Content
from content_api.repositories.s3_media import MediaObjects


def table():
    client = boto3.client('dynamodb', region_name='ap-southeast-1')
    client.create_table(TableName='integration', BillingMode='PAY_PER_REQUEST',
                        KeySchema=[{'AttributeName': 'PK', 'KeyType': 'HASH'}, {'AttributeName': 'SK', 'KeyType': 'RANGE'}],
                        AttributeDefinitions=[{'AttributeName': key, 'AttributeType': 'S'} for key in ('PK', 'SK', 'GSI1PK', 'GSI1SK')],
                        GlobalSecondaryIndexes=[{'IndexName': 'GSI1',
                            'KeySchema': [{'AttributeName': 'GSI1PK', 'KeyType': 'HASH'}, {'AttributeName': 'GSI1SK', 'KeyType': 'RANGE'}],
                            'Projection': {'ProjectionType': 'KEYS_ONLY'}}])
    return Store(client, 'integration')


@mock_aws
@pytest.mark.parametrize('kind', ['LESSON', 'PROGRAM', 'REFERENCE'])
def test_real_dynamodb_revision_roundtrip(kind):
    store = table()
    service = Content(kind, store)
    doc = {'type': 'doc', 'content': [{'type': 'paragraph'}]}
    bodies = {
        'LESSON': {'title': 'Lesson', 'level': 'Ấu Nhi', 'sublevel': 'Ấu 1', 'lessonNumber': 1, 'durationMinutes': 45},
        'REFERENCE': {'title': 'Reference', 'category': 'Sinh hoạt', 'content': doc},
        'PROGRAM': {'title': 'Program', 'level': 'Ấu Nhi', 'sublevel': 'Ấu 1', 'scheduleColumns': [{'id': 'date', 'label': 'Ngày'}], 'schedule': []},
    }
    principal = {'sub': 'editor', 'groups': ('editor',)}
    request = {'body': bodies[kind], 'path_parameters': {}, 'query': {}, 'request_id': 'test'}
    created = service.create_draft(request, principal)
    request['path_parameters'] = {kind.lower() + 'Id': created[kind.lower() + 'Id']}
    request['body'] = {'version': 1}
    published = service.publish(request, principal)
    assert published['version'] == 2
    assert service.get_published(request, principal)['title'] == bodies[kind]['title']
    assert len(service.list_published(request, principal).items) == 1
    with pytest.raises(ApiError):
        service.publish(request, principal)
    request['body'] = {}
    service.archive(request, principal)
    assert service.list_published(request, principal).items == []
    request['query'] = {'includeDeleted': 'true'}
    assert service.list_management(request, principal).items[0]['status'] == 'DELETED'
    request['query'] = {}
    service.restore(request, principal)
    assert service.get_published(request, principal)['title'] == bodies[kind]['title']


@mock_aws
def test_real_s3_versions_pinned_and_cleanup_exact_key():
    client = boto3.client('s3', region_name='ap-southeast-1')
    client.create_bucket(Bucket='private-media-test', CreateBucketConfiguration={'LocationConstraint': 'ap-southeast-1'})
    client.put_bucket_versioning(Bucket='private-media-test', VersioningConfiguration={'Status': 'Enabled'})
    key = 'lesson-media/lesson_1/media_1'
    first = client.put_object(Bucket='private-media-test', Key=key, Body=b'old', ContentType='image/jpeg')
    client.put_object(Bucket='private-media-test', Key=key, Body=b'new', ContentType='image/jpeg')
    client.put_object(Bucket='private-media-test', Key=key + '-other', Body=b'keep')
    objects = MediaObjects(client, 'private-media-test')
    item = {'objectKey': key, 'objectVersion': first['VersionId']}
    assert objects.head(item)['VersionId'] == first['VersionId']
    assert client.get_object(Bucket='private-media-test', Key=key, VersionId=first['VersionId'])['Body'].read() == b'old'
    objects.delete_all(item)
    versions = client.list_object_versions(Bucket='private-media-test')['Versions']
    assert [row['Key'] for row in versions] == [key + '-other']


@mock_aws
def test_real_cognito_and_account_creation(monkeypatch):
    from users_api.services.accounts import create_account
    store = table()
    monkeypatch.setenv('TABLE_NAME', 'integration')
    cognito = boto3.client('cognito-idp', region_name='ap-southeast-1')
    pool = cognito.create_user_pool(PoolName='integration')['UserPool']['Id']
    cognito.create_group(UserPoolId=pool, GroupName='reader')
    monkeypatch.setenv('USER_POOL_ID', pool)
    result = create_account({'body': {'email': 'reader@example.com', 'password': 'Password!123', 'role': 'READER'},
                             'path_parameters': {}, 'query': {}, 'request_id': 'test'},
                            {'sub': 'operator', 'groups': ('admin',)})
    account = store.get('ACCOUNT#' + result['cognitoSub'])
    assert account['accountStatus'] == 'ACTIVE'
    assert 'password' not in account
    user = cognito.admin_get_user(UserPoolId=pool, Username=account['cognitoUsername'])
    assert user['UserStatus'] == 'CONFIRMED'
