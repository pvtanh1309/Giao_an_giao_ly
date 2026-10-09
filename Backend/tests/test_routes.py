"""Exercise every route/role at the shared HTTP boundary."""
import importlib
import json
import re
from pathlib import Path

import pytest
from content_api.routes import ROUTES as CONTENT
from users_api.routes import ROUTES as USERS
from shared.http import handle

CASES = [(route, target, allowed, group) for route, (target, allowed) in {**CONTENT, **USERS}.items()
         for group in ("reader", "editor", "admin")]


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
    response = handle(event, None, {**CONTENT, **USERS}, lambda *args: None)
    expected = 403
    if group in allowed:
        expected = 201 if route in {"POST /manage/lessons", "POST /manage/programs", "POST /manage/references", "POST /manage/catechists", "POST /admin/accounts"} else 200
    assert response["statusCode"] == expected
    assert bool(called) == (group in allowed)
    assert json.loads(response["body"])["meta"]["requestId"] == "request"


def test_all_contract_routes_present():
    contract = (Path(__file__).parents[1] / "docs" / "api-contract-v1.md").read_text(encoding="utf-8")
    expected = set(re.findall(r"\|\s*`((?:GET|POST|PUT|DELETE) /[^`]+)`", contract))
    assert len(expected) == 42
    assert expected == set(CONTENT) | set(USERS)
