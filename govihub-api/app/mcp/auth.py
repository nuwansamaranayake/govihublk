"""GoviHub MCP Auth — Bearer token verification against MCP_ADMIN_SECRET."""

from fastapi import Request
from fastapi.responses import ORJSONResponse

from app.config import settings


async def verify_mcp_token(request: Request) -> None:
    """Verify MCP admin token from header OR query parameter.

    Accepts token from (in priority order):
    1. Authorization: Bearer <token> header
    2. ?token=<token> query parameter (for Claude.ai connector compatibility)

    Raises HTTP 401 if no token provided from either source.
    Raises HTTP 403 if the token does not match MCP_ADMIN_SECRET.
    """
    token: str | None = None

    # 1. Check Authorization header first
    authorization: str | None = request.headers.get("Authorization")
    if authorization:
        parts = authorization.split(" ", 1)
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1].strip()

    # 2. Fall back to query parameter
    if not token:
        token = request.query_params.get("token")

    # 3. Reject if no token from either source
    if not token:
        raise _unauthorized(
            "Missing authentication. Provide Authorization header or ?token= parameter"
        )

    # 4. Validate
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
