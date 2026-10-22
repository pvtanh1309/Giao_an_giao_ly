"""HTTP routes owned by the catalog Lambda."""
from content_api.routes import ROUTES as CONTENT_ROUTES


CATALOG_SERVICE_MODULES = frozenset({
    "content_api.services.programs",
    "content_api.services.references",
})

ROUTES = {
    route_key: route
    for route_key, route in CONTENT_ROUTES.items()
    if route[0].rsplit(".", 1)[0] in CATALOG_SERVICE_MODULES
}
