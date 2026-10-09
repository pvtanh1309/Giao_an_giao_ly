"""HTTP v2 entrypoint and DynamoDB TTL consumer."""
from shared.http import handle
from users_api.routes import ROUTES
from users_api.stream import handle_stream


def lambda_handler(event, context):
    return handle(event, context, ROUTES, handle_stream)
