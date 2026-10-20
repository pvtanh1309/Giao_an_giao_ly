"""HTTP routes owned by the lessons Lambda."""
from content_api.routes import ROUTES as CONTENT_ROUTES


LESSON_SERVICE_MODULES = frozenset({
    "content_api.services.lessons",
    "content_api.services.lesson_notes",
    "content_api.services.media",
})

ROUTES = {
    route_key: route
    for route_key, route in CONTENT_ROUTES.items()
    if route[0].rsplit(".", 1)[0] in LESSON_SERVICE_MODULES
}
