"""API Gateway payload v2 JSON responses."""
import json
from dataclasses import dataclass
from decimal import Decimal


@dataclass
class Page:
    items: list
    next_cursor: str | None = None


def json_default(value):
    if isinstance(value, Decimal):
        return int(value) if value == value.to_integral_value() else float(value)
    raise TypeError("Unsupported JSON value")


def envelope(payload, status_code):
    return {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store"},
        "isBase64Encoded": False,
        "body": json.dumps(payload, ensure_ascii=False, default=json_default, allow_nan=False),
    }


def success(data, request_id, status_code=200):
    meta = {"requestId": request_id}
    if isinstance(data, Page):
        if data.next_cursor:
            meta["nextCursor"] = data.next_cursor
        data = data.items
    return envelope({"data": data, "meta": meta}, status_code)


def failure(code, message, request_id, status_code, details=None):
    return envelope({"error": {"code": code, "message": message, "details": details or []},
                     "meta": {"requestId": request_id}}, status_code)
