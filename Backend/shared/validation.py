"""Small strict validators shared by request models."""
from shared.errors import ApiError


def invalid(field, message="Giá trị không hợp lệ."):
    raise ApiError(400, "VALIDATION_ERROR", "Dữ liệu gửi lên chưa hợp lệ.", [{"field": field, "message": message}])


def fields(body, allowed, required=()):
    if not isinstance(body, dict):
        invalid("body", "Phải là JSON object.")
    unknown = set(body) - set(allowed)
    if unknown:
        invalid(sorted(unknown)[0], "Trường không được phép.")
    for field in required:
        if field not in body:
            invalid(field, "Không được để trống.")
    return body


def text(value, field, required=True, max_length=1000):
    if value is None and not required:
        return ""
    if not isinstance(value, str) or len(value) > max_length or (required and not value.strip()):
        invalid(field)
    return value.strip()


def integer(value, field, minimum=1, maximum=1000000):
    if isinstance(value, bool) or not isinstance(value, int) or not minimum <= value <= maximum:
        invalid(field)
    return value


def version(body):
    return integer(body.get("version"), "version")
