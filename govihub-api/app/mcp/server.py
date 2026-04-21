"""GoviHub MCP Server — SSE-based Model Context Protocol endpoint.

Implements:
  GET  /mcp/sse              — SSE stream; verifies auth; yields session endpoint URL
  POST /mcp/messages/{sid}   — JSON-RPC 2.0 dispatcher for initialize / tools/list / tools/call
"""

from __future__ import annotations

import asyncio
import json
import uuid
from typing import Any, AsyncGenerator

import structlog
from fastapi import APIRouter, Request
from fastapi.responses import ORJSONResponse, StreamingResponse

from app.mcp.auth import MCPAuthError, verify_mcp_token
from app.mcp.tools import TOOL_DEFINITIONS, TOOL_HANDLERS

logger = structlog.get_logger()

router = APIRouter()

# ---------------------------------------------------------------------------
# In-process session store
# Each session: { "queue": asyncio.Queue, "active": bool }
# ---------------------------------------------------------------------------
_SESSIONS: dict[str, dict[str, Any]] = {}

MCP_PROTOCOL_VERSION = "2024-11-05"
SERVER_INFO = {"name": "govihub-spices-mcp", "version": "1.0.0"}


# ---------------------------------------------------------------------------
# JSON-RPC helpers
# ---------------------------------------------------------------------------

def _rpc_result(request_id: Any, result: Any) -> dict:
    return {"jsonrpc": "2.0", "id": request_id, "result": result}


def _rpc_error(request_id: Any, code: int, message: str, data: Any = None) -> dict:
    error: dict[str, Any] = {"code": code, "message": message}
    if data is not None:
        error["data"] = data
    return {"jsonrpc": "2.0", "id": request_id, "error": error}


# ---------------------------------------------------------------------------
# MCP method handlers
# ---------------------------------------------------------------------------

def handle_initialize(request_id: Any, params: dict) -> dict:
    """Respond to MCP initialize request."""
    client_info = params.get("clientInfo", {})
    logger.info(
        "mcp_initialize",
        client_name=client_info.get("name"),
        client_version=client_info.get("version"),
    )
    return _rpc_result(
        request_id,
        {
            "protocolVersion": MCP_PROTOCOL_VERSION,
            "capabilities": {
                "tools": {"listChanged": False},
            },
            "serverInfo": SERVER_INFO,
            "instructions": (
                "GoviHub MCP server exposes agricultural marketplace data for Sri Lanka. "
                "Use tools/list to discover available tools and tools/call to invoke them."
            ),
        },
    )


def handle_tools_list(request_id: Any, _params: dict) -> dict:
    """Return the list of all available tools."""
    return _rpc_result(request_id, {"tools": TOOL_DEFINITIONS})


async def handle_tool_call(request_id: Any, params: dict) -> dict:
    """Invoke the requested tool and return the result."""
    tool_name: str = params.get("name", "")
    tool_args: dict = params.get("arguments", {}) or {}

    if tool_name not in TOOL_HANDLERS:
        return _rpc_error(
            request_id,
            code=-32601,
            message=f"Unknown tool: {tool_name}",
            data={"available_tools": [t["name"] for t in TOOL_DEFINITIONS]},
        )

    handler = TOOL_HANDLERS[tool_name]
    try:
        result_data = await handler(tool_args)
        logger.info("mcp_tool_call", tool=tool_name, success=True)
        return _rpc_result(
            request_id,
            {
                "content": [
                    {
                        "type": "text",
                        "text": json.dumps(result_data, default=str, ensure_ascii=False),
                    }
                ],
                "isError": False,
            },
        )
    except Exception as exc:
        logger.exception("mcp_tool_call_error", tool=tool_name, error=str(exc))
        return _rpc_result(
            request_id,
            {
                "content": [
                    {
                        "type": "text",
                        "text": json.dumps(
                            {"error": str(exc), "tool": tool_name},
                            ensure_ascii=False,
                        ),
                    }
                ],
                "isError": True,
            },
        )


# ---------------------------------------------------------------------------
# SSE endpoint — GET /mcp/sse
# ---------------------------------------------------------------------------

@router.get("/sse", summary="MCP SSE Stream")
async def mcp_sse(request: Request) -> StreamingResponse:
    """Open an SSE connection.  Verifies MCP auth, creates a session, and sends
    the endpoint event so the client knows where to POST messages."""

    try:
        await verify_mcp_token(request)
    except MCPAuthError as exc:
        return ORJSONResponse(
            status_code=exc.status_code,
            content={"error": exc.detail},
        )

    session_id = str(uuid.uuid4())
    session_queue: asyncio.Queue = asyncio.Queue()
    _SESSIONS[session_id] = {"queue": session_queue, "active": True, "authenticated": True}

    logger.info("mcp_session_opened", session_id=session_id)

    async def event_stream() -> AsyncGenerator[str, None]:
        try:
            # First event: advertise the POST endpoint for this session
            # Include token in endpoint URL for MCP clients
            _token = request.query_params.get("token", "")
            if _token:
                endpoint_url = f"/mcp/messages/{session_id}?token={_token}"
            else:
                endpoint_url = f"/mcp/messages/{session_id}"
            yield f"event: endpoint\ndata: {endpoint_url}\n\n"

            # Stream queued server→client events
            while _SESSIONS.get(session_id, {}).get("active", False):
                try:
                    message = await asyncio.wait_for(session_queue.get(), timeout=30.0)
                    payload = json.dumps(message, default=str, ensure_ascii=False)
                    yield f"event: message\ndata: {payload}\n\n"
                except asyncio.TimeoutError:
                    # Send a keepalive comment
                    yield ": keepalive\n\n"
                except asyncio.CancelledError:
                    break
        finally:
            _SESSIONS.pop(session_id, None)
            logger.info("mcp_session_closed", session_id=session_id)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ---------------------------------------------------------------------------
# Message endpoint — POST /mcp/messages/{session_id}
# ---------------------------------------------------------------------------

@router.post("/messages/{session_id}", summary="MCP Message Handler")
async def mcp_messages(session_id: str, request: Request) -> ORJSONResponse:
    """Receive JSON-RPC 2.0 messages from the MCP client."""

    session = _SESSIONS.get(session_id)
    if session is None:
        return ORJSONResponse(
            status_code=404,
            content={"error": f"Session {session_id} not found or expired"},
        )

    # Skip token check if session was already authenticated via SSE handshake
    if not session.get("authenticated"):
        try:
            await verify_mcp_token(request)
        except MCPAuthError as exc:
            return ORJSONResponse(
                status_code=exc.status_code,
                content={"error": exc.detail},
            )

    try:
        body = await request.json()
    except Exception:
        return ORJSONResponse(
            status_code=400,
            content=_rpc_error(None, -32700, "Parse error: invalid JSON"),
        )

    method: str = body.get("method", "")
    params: dict = body.get("params") or {}
    request_id: Any = body.get("id")

    logger.info("mcp_message_received", session_id=session_id, method=method, id=request_id)

    # Dispatch
    if method == "initialize":
        response = handle_initialize(request_id, params)

    elif method == "tools/list":
        response = handle_tools_list(request_id, params)

    elif method == "tools/call":
        response = await handle_tool_call(request_id, params)

    elif method == "notifications/initialized":
        # Client-only notification — acknowledge with no response
        return ORJSONResponse(status_code=204, content=None)

    elif method == "ping":
        response = _rpc_result(request_id, {})

    else:
        response = _rpc_error(
            request_id,
            -32601,
            f"Method not found: {method}",
            data={"supported_methods": ["initialize", "tools/list", "tools/call", "ping"]},
        )

    # Push response onto the SSE queue so it's delivered over the stream,
    # and also return it directly as HTTP response for request-response clients.
    try:
        session["queue"].put_nowait(response)
    except asyncio.QueueFull:
        logger.warning("mcp_session_queue_full", session_id=session_id)

    return ORJSONResponse(content=response)
