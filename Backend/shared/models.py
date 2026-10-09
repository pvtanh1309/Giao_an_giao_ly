"""IDs, timestamps and stable, query-bound pagination for the small catalog."""
import base64
import hashlib
import json
import time
import unicodedata
import uuid
from datetime import datetime, timezone
from shared.errors import ApiError
from shared.responses import Page


def now():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def epoch():
    return int(time.time())


def new_id(prefix):
    return prefix.rstrip("_") + "_" + uuid.uuid4().hex


def normalize(value):
    decomposed = unicodedata.normalize("NFD", value.lower().replace("đ", "d"))
    return " ".join("".join(c for c in decomposed if unicodedata.category(c) != "Mn").split())


def public(item):
    return {key: value for key, value in item.items()
            if key not in {"PK", "SK", "GSI1PK", "GSI1SK", "normalizedTitle", "normalizedName", "normalizedEmail"}
            and not key.startswith("_")}


def paginate(items, query, scope):
    try:
        raw_limit = query.get("limit", "20")
        if isinstance(raw_limit, bool) or str(int(raw_limit)) != str(raw_limit):
            raise ValueError()
        limit = int(raw_limit)
        if not 1 <= limit <= 50:
            raise ValueError()
    except (ValueError, TypeError):
        raise ApiError(400, "VALIDATION_ERROR", "limit phải từ 1 đến 50.") from None
    binding = hashlib.sha256(json.dumps([scope, {k: v for k, v in query.items() if k not in {"cursor", "limit"}}],
                                        sort_keys=True).encode()).hexdigest()[:24]

    def key(item):
        identity = next((item[k] for k in ("lessonId", "programId", "referenceId", "catechistId", "cognitoSub") if k in item), "")
        return normalize(str(item.get("title", item.get("name", item.get("email", ""))))) + "#" + str(identity)

    ordered = sorted(items, key=key)
    if query.get("cursor"):
        try:
            token = query["cursor"]
            if not isinstance(token, str) or len(token) > 2048:
                raise ValueError()
            cursor = json.loads(base64.urlsafe_b64decode(token + "=" * (-len(token) % 4)))
            if cursor["scope"] != binding or not isinstance(cursor["after"], str):
                raise ValueError()
            ordered = [item for item in ordered if key(item) > cursor["after"]]
        except (ValueError, TypeError, KeyError):
            raise ApiError(400, "VALIDATION_ERROR", "Cursor không hợp lệ cho truy vấn này.") from None
    page = ordered[:limit]
    cursor = None
    if len(ordered) > limit:
        cursor = base64.urlsafe_b64encode(json.dumps({"scope": binding, "after": key(page[-1])}).encode()).decode().rstrip("=")
    return Page([public(item) for item in page], cursor)
