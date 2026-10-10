"""Shared Lambda HTTP boundary."""
import base64
import importlib
import json
import logging
import uuid
from shared.auth import principal_from_event, require_groups, require_active_account
from shared.errors import ApiError
from shared.responses import success, failure

logger = logging.getLogger(__name__)


def parse_request(event, request_id=None):
    raw = event.get("body") or "{}"
    try:
        if event.get("isBase64Encoded"):
            raw = base64.b64decode(raw, validate=True).decode("utf-8")

        if not isinstance(raw, str) or len(raw.encode("utf-8")) > 300 * 1024:
            raise ApiError(413, "CONTENT_TOO_LARGE", "Request vượt giới hạn 300 KB.")
        
        body = json.loads(raw, parse_constant=lambda _: (_ for _ in ()).throw(ValueError()))

        if not isinstance(body, dict):
            raise ValueError()
        
    except (ValueError, TypeError, UnicodeError):
        raise ApiError(400, "VALIDATION_ERROR", "Body phải là JSON object hợp lệ.") from None
    return {"body": body, "path_parameters": event.get("pathParameters") or {},
            "query": event.get("queryStringParameters") or {},
            "request_id": request_id or event.get("requestContext", {}).get("requestId") or str(uuid.uuid4())}


def dispatch(event, routes, request_id=None):
    principal = principal_from_event(event)
    route = routes.get(event.get("routeKey"))
    if route is None:
        raise ApiError(404, "NOT_FOUND", "API không tồn tại.")
    target, groups = route
    require_groups(principal, groups)
    require_active_account(principal, event)
    request = parse_request(event, request_id)
    module, function = target.rsplit(".", 1)
    return getattr(importlib.import_module(module), function)(request, principal)


def handle(event, context, routes, stream_handler):
    if "Records" in event:
        return stream_handler(event, context)
    
    request_id = event.get("requestContext", {}).get("requestId") or getattr(context, "aws_request_id", None) or str(uuid.uuid4())
    try:
        data = dispatch(event, routes, request_id)
        status = 201 if event.get("routeKey") in {"POST /manage/lessons", "POST /manage/programs", "POST /manage/references", "POST /manage/catechists", "POST /admin/accounts"} else 200
        return success(data, request_id, status)
    except ApiError as exc:
        return failure(exc.code, exc.message, request_id, exc.status, exc.details)
    except Exception as exc:
        logger.error("request_failed request_id=%s exception_type=%s", request_id, type(exc).__name__)
        return failure("INTERNAL_ERROR", "Không thể xử lý yêu cầu. Vui lòng thử lại.", request_id, 500)
