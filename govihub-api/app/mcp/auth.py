"""GoviHub MCP Auth — Bearer token verification against MCP_ADMIN_SECRET."""

from fastapi import Request
from fastapi.responses import ORJSONResponse

from app.config import settings


async def verify_mcp_token(request: Request) -> None:
    """Verify that the Authorization Bearer token matches MCP_ADMIN_SECRET.

    Raises HTTP 401 if Authorization header is missing or malformed.
    Raises HTTP 403 if the token does not match MCP_ADMIN_SECRET.
    """
    authorization: str | None = request.headers.get("Authorization")

    if not authorization:
        raise _unauthorized("Missing Authorization header")

    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise _unauthorized("Authorization header must be: Bearer <token>")

    token = parts[1].strip()
    if not token:
        raise _unauthorized("Bearer token is empty")

    if token != settings.MCP_ADMIN_SECRET:
        raise _forbidden("Invalid MCP admin token")


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

class MCPAuthError(Exception):
    """Raised when MCP authentication/authorisation fails."""

    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


def _unauthorized(detail: str) -> MCPAuthError:
    return MCPAuthError(status_code=401, detail=detail)


def _forbidden(detail: str) -> MCPAuthError:
    return MCPAuthError(status_code=403, detail=detail)
