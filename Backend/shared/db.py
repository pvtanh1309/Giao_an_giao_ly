"""DynamoDB adapter with conditional atomic writes and paginated queries."""
import os
from shared.errors import ApiError
from shared.models import public

clean = public


class Store:
    def __init__(self, client=None, table_name=None):
        import boto3
        from botocore.config import Config
        from boto3.dynamodb.types import TypeSerializer, TypeDeserializer
        self.client = client or boto3.client("dynamodb", config=Config(
            connect_timeout=3, read_timeout=5, retries={"mode": "standard", "max_attempts": 2}))
        self.table = table_name or os.environ["TABLE_NAME"]
        self.serializer = TypeSerializer()
        self.deserializer = TypeDeserializer()

    def encode(self, item):
        return {key: self.serializer.serialize(value) for key, value in item.items()}

    def decode(self, item):
        return {key: self.deserializer.deserialize(value) for key, value in item.items()}

    def get(self, pk, sk="PROFILE"):
        result = self.client.get_item(TableName=self.table, Key=self.encode({"PK": pk, "SK": sk}), ConsistentRead=True)
        return self.decode(result["Item"]) if "Item" in result else None

    def _query(self, **kwargs):
        items = []
        while True:
            response = self.client.query(TableName=self.table, **kwargs)
            items.extend(self.decode(item) for item in response.get("Items", []))
            if not response.get("LastEvaluatedKey"):
                return items
            kwargs["ExclusiveStartKey"] = response["LastEvaluatedKey"]

    def query(self, pk):
        return self._query(KeyConditionExpression="PK = :pk", ExpressionAttributeValues=self.encode({":pk": pk}), ConsistentRead=True)

    def transact_get(self, keys):
        """Read a revision snapshot with serializable isolation against transaction writes."""
        if not keys or len(keys) > 100:
            raise ValueError("Transaction reads need between 1 and 100 keys")
        response = self.client.transact_get_items(TransactItems=[
            {"Get": {"TableName": self.table, "Key": self.encode(key)}} for key in keys])
        return [self.decode(row["Item"]) for row in response.get("Responses", []) if "Item" in row]

    def query_index(self, partition):
        return self._query(IndexName="GSI1", KeyConditionExpression="GSI1PK = :pk", ExpressionAttributeValues=self.encode({":pk": partition}))

    def put(self, item, expected_version=None, create=False):
        self.transact([{"put": item, "version": expected_version, "create": create}])

    def delete(self, pk, sk="PROFILE", expected_version=None):
        self.transact([{"delete": {"PK": pk, "SK": sk}, "version": expected_version}])

    def transact(self, writes):
        if not writes:
            return
        if len(writes) > 100:
            raise ApiError(400, "VALIDATION_ERROR", "Thao tác vượt giới hạn transaction.")
        operations = []
        for write in writes:
            kind = next(key for key in ("put", "delete", "check") if key in write)
            params = {"TableName": self.table, "Item" if kind == "put" else "Key": self.encode(write[kind])}
            if write.get("version") is not None:
                params.update(ConditionExpression="#v = :v", ExpressionAttributeNames={"#v": "version"},
                              ExpressionAttributeValues=self.encode({":v": write["version"]}))
            elif write.get("create") or write.get("exists") is False:
                params["ConditionExpression"] = "attribute_not_exists(PK)"
            elif kind == "check" or write.get("exists"):
                params["ConditionExpression"] = "attribute_exists(PK)"
            operations.append({{"put": "Put", "delete": "Delete", "check": "ConditionCheck"}[kind]: params})
        try:
            self.client.transact_write_items(TransactItems=operations)
        except self.client.exceptions.TransactionCanceledException as exc:
            codes = {reason.get("Code") for reason in exc.response.get("CancellationReasons", [])}
            if "ConditionalCheckFailed" in codes:
                raise ApiError(409, "VERSION_CONFLICT", "Dữ liệu đã thay đổi. Hãy tải lại.") from None
            raise
