"""Exercise every route/role at the shared HTTP boundary."""
import importlib
import json
import re
from pathlib import Path

import pytest
from content_api.routes import ROUTES as CONTENT
from lessons_api.routes import ROUTES as LESSONS
from catalog_api.routes import ROUTES as CATALOG
from users_api.routes import ROUTES as USERS
from users_api.handler import lambda_handler as users_handler
from shared.http import handle

CASES = [(route, target, allowed, group) for route, (target, allowed) in {**LESSONS, **CATALOG, **USERS}.items()
         for group in ("reader", "editor", "admin")]


def test_route_partition_is_disjoint_and_complete():
    from lessons_api.routes import ROUTES as LESSONS
    from catalog_api.routes import ROUTES as CATALOG

    expected_lessons = {
        "GET /me/lessons/{lessonId}/notes",
        "POST /me/lessons/{lessonId}/notes",
        "PUT /me/lessons/{lessonId}/notes/{noteId}",
        "DELETE /me/lessons/{lessonId}/notes/{noteId}",
        "GET /manage/lessons",
        "GET /lessons",
        "GET /lessons/{lessonId}",
        "POST /manage/lessons",
        "PUT /manage/lessons/{lessonId}/draft",
        "POST /manage/lessons/{lessonId}/publish",
        "DELETE /manage/lessons/{lessonId}",
        "POST /manage/lessons/{lessonId}/restore",
        "GET /manage/lessons/{lessonId}",
        "POST /manage/lessons/{lessonId}/media-upload-url",
    }
    expected_catalog = {
        "GET /manage/programs",
        "GET /manage/programs/{programId}",
        "GET /programs",
        "GET /programs/{programId}",
        "POST /manage/programs",
        "PUT /manage/programs/{programId}/draft",
        "POST /manage/programs/{programId}/publish",
        "DELETE /manage/programs/{programId}",
        "POST /manage/programs/{programId}/restore",
        "GET /references",
        "GET /references/{referenceId}",
        "GET /manage/references",
        "GET /manage/references/{referenceId}",
        "POST /manage/references",
        "PUT /manage/references/{referenceId}/draft",
        "POST /manage/references/{referenceId}/publish",
        "DELETE /manage/references/{referenceId}",
        "POST /manage/references/{referenceId}/restore",
    }
    lesson_keys, catalog_keys = set(LESSONS), set(CATALOG)

    assert lesson_keys == expected_lessons
    assert catalog_keys == expected_catalog
    assert len(lesson_keys) == 14
    assert len(catalog_keys) == 18
    assert lesson_keys.isdisjoint(catalog_keys)
    assert lesson_keys | catalog_keys == set(CONTENT)


def test_catalog_handler_rejects_stream_event():
    from catalog_api.handler import lambda_handler

    with pytest.raises(RuntimeError, match="catalog Lambda does not accept DynamoDB stream events"):
        lambda_handler({"Records": []}, None)


def test_shared_http_rejects_stream_without_stream_handler():
    with pytest.raises(RuntimeError, match="DynamoDB stream event received without a configured stream handler"):
        handle({"Records": []}, None, {})


def test_lessons_http_handler_does_not_import_media(monkeypatch):
    import importlib
    import sys
    import shared.http as http

    monkeypatch.setitem(sys.modules, "content_api.services.media", None)
    monkeypatch.setattr(http, "dispatch", lambda *args: {"ok": True})
    handler = importlib.import_module("lessons_api.handler")
    if handler.__spec__ is not None:
        handler = importlib.reload(handler)

    response = handler.lambda_handler({"version": "2.0", "routeKey": "GET /lessons"}, None)

    assert response["statusCode"] == 200
    assert json.loads(response["body"])["data"] == {"ok": True}


def test_lessons_handler_preserves_stream_partial_failures(monkeypatch):
    from content_api.services import media
    from lessons_api.handler import lambda_handler

    expected = {"batchItemFailures": [{"itemIdentifier": "sequence-17"}]}
    monkeypatch.setattr(media, "handle_stream", lambda event, context: expected)

    response = lambda_handler({"Records": [{"eventID": "sequence-17"}]}, None)

    assert response == expected


@pytest.mark.parametrize("route,target,allowed,group", CASES)
def test_route_role_matrix(route, target, allowed, group, monkeypatch):
    monkeypatch.setattr('shared.http.require_active_account', lambda *args: None)
    module, function = target.rsplit(".", 1)
    called = []
    def service(request, principal):
        called.append(principal)
        return {"ok": True}
    monkeypatch.setattr(importlib.import_module(module), function, service)
    event = {"routeKey": route, "requestContext": {"requestId": "request", "authorizer": {"jwt": {
        "claims": {"sub": "caller", "token_use": "access", "cognito:groups": [group]}}}}}
    if route in LESSONS:
        from lessons_api.handler import lambda_handler
    elif route in CATALOG:
        from catalog_api.handler import lambda_handler
    else:
        lambda_handler = users_handler
    response = lambda_handler(event, None)
    expected = 403
    if group in allowed:
        expected = 201 if route in {"POST /manage/lessons", "POST /manage/programs", "POST /manage/references", "POST /manage/catechists", "POST /admin/accounts", "POST /me/lessons/{lessonId}/notes"} else 200
    assert response["statusCode"] == expected
    assert bool(called) == (group in allowed)
    assert json.loads(response["body"])["meta"]["requestId"] == "request"


def test_all_contract_routes_present():
    contract = (Path(__file__).parents[2] / "docs" / "CONTEXT.md").read_text(encoding="utf-8")
    expected = set(re.findall(r"\|\s*`((?:GET|POST|PUT|DELETE) /[^`]+)`", contract))
    assert len(expected) >= 44
    assert expected == set(CONTENT) | set(USERS)


@pytest.mark.parametrize('module,routes', [('content-api', CONTENT), ('user-api', USERS)])
def test_terraform_routes_match_python_registry(module, routes):
    source = (Path(__file__).parents[2] / 'infrastructure' / 'modules' / module / 'main.tf').read_text(encoding='utf-8')
    declared = set(re.findall(r'"((?:GET|POST|PUT|DELETE) /[^"\n]+)"', source))
    assert declared == set(routes)
