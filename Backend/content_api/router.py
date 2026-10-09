"""Static allowlisted route dispatch."""
from shared.http import dispatch as dispatch_http
from content_api.routes import ROUTES


def dispatch(event, principal=None):
    # Always re-read verified Gateway claims; a supplied principal cannot bypass auth.
    return dispatch_http(event, ROUTES)
