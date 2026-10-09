"""Trust only claims supplied by the configured Gateway JWT authorizer."""
import json
import os
import re
from shared.errors import ApiError


def principal_from_event(event):
    claims = event.get("requestContext", {}).get("authorizer", {}).get("jwt", {}).get("claims", {})
    if not isinstance(claims, dict) or not isinstance(claims.get("sub"), str) or not claims["sub"]:
        raise ApiError(401, "UNAUTHORIZED", "Cần đăng nhập.")
    if claims.get("token_use") != "access":
        raise ApiError(401, "UNAUTHORIZED", "Cần access token hợp lệ.")
    client = os.environ.get("USER_POOL_CLIENT_ID")
    if client and claims.get("client_id") != client:
        raise ApiError(401, "UNAUTHORIZED", "Token không thuộc ứng dụng.")
    groups = claims.get("cognito:groups", [])
    if isinstance(groups, str):
        try:
            groups = json.loads(groups)
        except ValueError:
            groups = re.split(r"[\s,]+", groups.strip("[] "))
    if not isinstance(groups, list) or any(not isinstance(g, str) for g in groups):
        groups = []
    return {"sub": claims["sub"], "groups": tuple(g for g in groups if g in {"admin", "editor", "reader"})}


def require_groups(principal, allowed_groups):
    if not set(principal.get("groups", ())).intersection(allowed_groups):
        raise ApiError(403, "FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.")


def require_active_account(principal, event):
    """JWT signatures survive Cognito disable; enforce current application status."""
    from shared.db import Store
    account = Store().get("ACCOUNT#" + principal["sub"])
    if (not account or account.get("accountStatus") != "ACTIVE"
            or account.get("pendingAction") in {"disable", "archive"}):
        raise ApiError(403, "FORBIDDEN", "Tài khoản hiện không hoạt động.")
    if account.get("role", "").lower() not in principal["groups"]:
        raise ApiError(403, "FORBIDDEN", "Quyền tài khoản đã thay đổi. Hãy đăng nhập lại.")
    if account.get("tokenValidAfter"):
        claims = event.get("requestContext", {}).get("authorizer", {}).get("jwt", {}).get("claims", {})
        try:
            valid = int(claims.get("iat", 0)) > int(account["tokenValidAfter"])
        except (TypeError, ValueError):
            valid = False
        if not valid:
            raise ApiError(401, "UNAUTHORIZED", "Phiên đăng nhập đã bị thu hồi. Hãy đăng nhập lại.")
