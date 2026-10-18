"""TTL account cleanup; return partial batch failures for retry/DLQ delivery."""
from shared.models import epoch
from users_api.repositories.dynamodb import Store
from users_api.repositories.cognito import Cognito


def handle_stream(event, context):
    from boto3.dynamodb.types import TypeDeserializer
    decoder = TypeDeserializer()
    failures = []
    for record in event.get('Records', []):
        sequence = record.get('dynamodb', {}).get('SequenceNumber', record.get('eventID', 'unknown'))
        try:
            identity = record.get('userIdentity', {})
            if (record.get('eventSource') != 'aws:dynamodb' or record.get('eventName') != 'REMOVE'
                    or identity.get('type') != 'Service' or identity.get('principalId') != 'dynamodb.amazonaws.com'):
                continue
            item = {k: decoder.deserialize(v) for k, v in record.get('dynamodb', {}).get('OldImage', {}).items()}
            if (item.get('entityType') != 'ACCOUNT' or item.get('SK') != 'PROFILE'
                    or item.get('accountStatus') != 'DELETED' or not item.get('purgeAt')
                    or item['purgeAt'] > epoch() or item.get('role') == 'ADMIN'):
                continue
            sub = item.get('cognitoSub')
            if not isinstance(sub, str) or item.get('PK') != 'ACCOUNT#' + sub:
                continue
            store = Store()
            if store.get(item['PK']) is not None:
                continue
            rows = [row for row in store.query(item['PK'])
                    if row.get('SK', '').startswith(('LESSONNOTE#', 'LESSONNOTECOUNT#'))]
            for offset in range(0, len(rows), 24):
                store.transact([{'check': {'PK': item['PK'], 'SK': 'PROFILE'}, 'exists': False}]
                    + [{'delete': {'PK': row['PK'], 'SK': row['SK']}, 'version': row.get('version')}
                       for row in rows[offset:offset + 24]])
            Cognito().delete(item.get('cognitoUsername', sub))
            if item.get('catechistId'):
                store.delete('CATECHIST#' + item['catechistId'], 'ACCOUNT#' + sub)
        except Exception:
            failures.append({'itemIdentifier': sequence})
    return {'batchItemFailures': failures}
