"""GoviHub Exceptions — Custom exception classes and handlers."""

from typing import Any, Optional

from fastapi import Request
from fastapi.responses import ORJSONResponse


class GoviHubException(Exception):
    """Base exception for all GoviHub errors."""

    def __init__(
        self,
        status_code: int = 500,
        detail: str = "Internal server error",
        error_code: str = "INTERNAL_ERROR",
        details: Optional[Any] = None,
    ):
        self.status_code = status_code
        self.detail = detail
        self.error_code = error_code
        self.details = details
        super().__init__(detail)


class NotFoundError(GoviHubException):
    def __init__(self, detail: str = "Resource not found", details: Any = None):
        super().__init__(status_code=404, detail=detail, error_code="NOT_FOUND", details=details)


class ForbiddenError(GoviHubException):
    def __init__(self, detail: str = "Forbidden", details: Any = None):
        super().__init__(status_code=403, detail=detail, error_code="FORBIDDEN", details=details)


class ValidationError(GoviHubException):
    def __init__(self, detail: str = "Validation error", details: Any = None):
        super().__init__(status_code=422, detail=detail, error_code="VALIDATION_ERROR", details=details)


class ExternalServiceError(GoviHubException):
    def __init__(self, detail: str = "External service error", details: Any = None):
        super().__init__(
            status_code=502, detail=detail, error_code="EXTERNAL_SERVICE_ERROR", details=details
        )


class UnauthorizedError(GoviHubException):
    def __init__(self, detail: str = "Unauthorized", details: Any = None):
        super().__init__(status_code=401, detail=detail, error_code="UNAUTHORIZED", details=details)


class ProfileIncompleteError(GoviHubException):
    """428 — non-admin user must finish capturing required profile fields (e.g. phone)."""

    def __init__(self, required_field: str = "phone"):
        super().__init__(
            status_code=428,
            detail="Profile is incomplete — required field missing.",
            error_code="PROFILE_INCOMPLETE",
            details={"required_field": required_field},
        )


async def govihub_exception_handler(request: Request, exc: GoviHubException) -> ORJSONResponse:
    """Format all GoviHub exceptions as consistent JSON error responses."""
    return ORJSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.error_code,
                "message": exc.detail,
                "details": exc.details,
            }
        },
    )
