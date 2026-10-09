"""Lambda entry point for API Gateway v2 and DynamoDB TTL stream events."""
from shared.http import handle
from content_api.routes import ROUTES
from content_api.services.media import handle_stream


def lambda_handler(event, context):
    return handle(event, context, ROUTES, handle_stream)
