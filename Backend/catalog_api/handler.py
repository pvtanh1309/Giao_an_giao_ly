"""Lambda entry point for programs and reference materials."""
from shared.http import handle
from catalog_api.routes import ROUTES


def lambda_handler(event, context):
    if "Records" in event:
        raise RuntimeError("catalog Lambda does not accept DynamoDB stream events")
    return handle(event, context, ROUTES)
