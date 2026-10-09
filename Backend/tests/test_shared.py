import base64
import json
from decimal import Decimal
from unittest.mock import Mock

import boto3
import pytest
from moto import mock_aws

from shared.auth import principal_from_event, require_groups
from shared.db import Store
from shared.errors import ApiError
from shared.http import handle, parse_request
from shared.models import normalize, paginate
from shared.responses import Page, success
from shared.tiptap_validator import validate_document, validate_revision_size


def event(groups=("reader",), token_use="access"):
    return {"routeKey": "GET /lessons", "requestContext": {"requestId": "req-1", "authorizer": {"jwt": {
        "claims": {"sub": "subject", "token_use": token_use, "cognito:groups": list(groups)}}}}}


@pytest.mark.parametrize("groups", [["reader"], '["reader"]', '[reader]', 'reader,editor'])
def test_verified_group_formats(groups):
    request = event()
    request["requestContext"]["authorizer"]["jwt"]["claims"]["cognito:groups"] = groups
    assert "reader" in principal_from_event(request)["groups"]


def test_id_token_and_unverified_header_rejected():
    for request in [event(token_use="id"), {"headers": {"Authorization": "Bearer anything"}}]:
        with pytest.raises(ApiError) as failure:
            principal_from_event(request)
        assert failure.value.status == 401


def test_wrong_client_rejected(monkeypatch):
    monkeypatch.setenv("USER_POOL_CLIENT_ID", "correct")
    with pytest.raises(ApiError):
        principal_from_event(event())


def test_reader_cannot_write():
    with pytest.raises(ApiError) as failure:
        require_groups(principal_from_event(event()), ("editor", "admin"))
    assert failure.value.status == 403


@pytest.mark.parametrize("raw", ['[]', 'null', '{', '{"x": NaN}'])
def test_invalid_json(raw):
    with pytest.raises(ApiError):
        parse_request({"body": raw})


def test_base64_utf8_and_request_id():
    raw = json.dumps({"title": "Giáo án"}, ensure_ascii=False).encode()
    parsed = parse_request({"body": base64.b64encode(raw).decode(), "isBase64Encoded": True}, "rid")
    assert parsed["body"]["title"] == "Giáo án"
    assert parsed["request_id"] == "rid"


def test_public_failure_does_not_leak_exception(monkeypatch):
    monkeypatch.setattr("shared.http.dispatch", Mock(side_effect=RuntimeError("secret-password")))
    response = handle(event(), None, {}, lambda *args: None)
    assert response["statusCode"] == 500
    assert "secret-password" not in response["body"]
    assert json.loads(response["body"])["meta"]["requestId"] == "req-1"


def test_page_envelope_and_decimal():
    payload = json.loads(success(Page([{"version": Decimal(2)}], "cursor"), "req")["body"])
    assert payload == {"data": [{"version": 2}], "meta": {"requestId": "req", "nextCursor": "cursor"}}


def test_cursor_bound_to_filters_and_no_duplicates():
    items = [{"lessonId": str(i), "title": "Same"} for i in range(4)]
    page = paginate(items, {"limit": "2", "q": "Same"}, "reader")
    other = paginate(items, {"limit": "2", "q": "Same", "cursor": page.next_cursor}, "reader")
    assert {x["lessonId"] for x in page.items}.isdisjoint(x["lessonId"] for x in other.items)
    with pytest.raises(ApiError):
        paginate(items, {"cursor": page.next_cursor, "q": "different"}, "reader")
    assert normalize("Đức Giêsu") == "duc giesu"


def test_tiptap_frontend_subset():
    doc = {"type": "doc", "content": [{"type": "paragraph", "attrs": {"indent": 1, "textAlign": "center"},
           "content": [{"type": "text", "text": "Xin chào", "marks": [{"type": "textStyle", "attrs": {
               "color": "#24354a", "fontFamily": "Georgia, serif", "fontSize": "16px"}}]}]}]}
    assert validate_document(doc) == doc


@pytest.mark.parametrize("node", [
    {"type": "script"},
    {"type": "image", "attrs": {"mediaId": "media_abc", "src": "https://evil"}},
    {"type": "text", "text": "x", "marks": [{"type": "link", "attrs": {"href": "javascript:alert(1)"}}]},
    {"type": "text", "text": "x", "marks": [{"type": "textStyle", "attrs": {"color": "red;display:none"}}]},
])
def test_untrusted_tiptap_rejected(node):
    with pytest.raises(ApiError):
        validate_document({"type": "doc", "content": [{"type": "paragraph", "content": [node]}]}, allow_images=True)


def test_aggregate_size_and_depth_rejected():
    with pytest.raises(ApiError) as failure:
        validate_revision_size([{"x": "a" * (110 * 1024)}] * 2)
    assert failure.value.status == 413
    value = {"type": "paragraph"}
    for _ in range(26):
        value = {"type": "blockquote", "content": [value]}
    with pytest.raises(ApiError):
        validate_document({"type": "doc", "content": [value]})


@mock_aws
def test_atomic_cas_prevents_partial_publish():
    client = boto3.client("dynamodb", region_name="ap-southeast-1")
    client.create_table(TableName="test", KeySchema=[{"AttributeName": "PK", "KeyType": "HASH"}, {"AttributeName": "SK", "KeyType": "RANGE"}],
                        AttributeDefinitions=[{"AttributeName": "PK", "AttributeType": "S"}, {"AttributeName": "SK", "AttributeType": "S"}], BillingMode="PAY_PER_REQUEST")
    store = Store(client, "test")
    store.put({"PK": "LESSON#1", "SK": "META", "version": 2}, create=True)
    with pytest.raises(ApiError) as failure:
        store.transact([{"put": {"PK": "LESSON#1", "SK": "META", "version": 3}, "version": 1},
                        {"put": {"PK": "LESSON#1", "SK": "PUBLISHED", "version": 3}}])
    assert failure.value.status == 409
    assert store.get("LESSON#1", "META")["version"] == 2
    assert store.get("LESSON#1", "PUBLISHED") is None
