"""GoviHub MCP Router — re-exports the FastAPI router from server.py."""

from app.mcp.server import router  # noqa: F401

__all__ = ["router"]
