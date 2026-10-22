"""Lambda entry point for lessons, private notes, and lesson media."""
from shared.http import handle
from lessons_api.routes import ROUTES


def _handle_media_stream(event, context):
    from content_api.services.media import handle_stream

    return handle_stream(event, context)


def lambda_handler(event, context):
    return handle(event, context, ROUTES, _handle_media_stream)
