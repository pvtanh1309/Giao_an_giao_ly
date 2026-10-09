"""Dispatch through the fixed users route registry."""
from shared.http import dispatch as dispatch_http
from users_api.routes import ROUTES


def dispatch(event, principal=None):
    return dispatch_http(event, ROUTES)
