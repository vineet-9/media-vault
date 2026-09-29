from functools import wraps

from flask import session

from .errors import ApiError


def admin_required_api(f):
    """Guards an /api/admin/... view: 401/403s as JSON as appropriate.
    Public lookup routes need no auth at all anymore."""

    @wraps(f)
    def wrapper(*args, **kwargs):
        user = session.get("admin")
        if not user:
            raise ApiError(401, "Admin sign-in required")
        return f(*args, **kwargs)

    return wrapper
