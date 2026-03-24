"""GoviHub MCP Tests — Auth validation, tools/list, tool handler invocation."""

from __future__ import annotations

import json
import uuid
from unittest.mock import AsyncMock, patch

import pytest

from app.mcp.auth import MCPAuthError, _forbidden, _unauthorized, verify_mcp_token
from app.mcp.server import (
    handle_initialize,
    handle_tools_list,
    _rpc_error,
    _rpc_result,
    MCP_PROTOCOL_VERSION,
    SERVER_INFO,
)
from app.mcp.tools import TOOL_DEFINITIONS, TOOL_HANDLERS


# ---------------------------------------------------------------------------
# MCP auth unit tests
# ---------------------------------------------------------------------------

def test_mcp_unauthorized_error_attributes():
    """MCPAuthError with 401 has correct status code."""
    err = _unauthorized("Missing auth header")
    assert err.status_code == 401
    assert "Missing auth header" in str(err)


def test_mcp_forbidden_error_attributes():
    """MCPAuthError with 403 has correct status code."""
    err = _forbidden("Invalid token")
    assert err.status_code == 403
    assert "Invalid token" in str(err)


@pytest.mark.asyncio
async def test_verify_mcp_token_missing_header():
    """verify_mcp_token raises 401 when Authorization header is absent."""
    from starlette.requests import Request
    from starlette.datastructures import Headers

    scope = {
        "type": "http",
        "method": "GET",
        "path": "/mcp/sse",
        "headers": [],
    }
    request = Request(scope)

    with pytest.raises(MCPAuthError) as exc_info:
        await verify_mcp_token(request)

    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_verify_mcp_token_wrong_secret():
    """verify_mcp_token raises 403 when token does not match MCP_ADMIN_SECRET."""
    from starlette.requests import Request

    headers = [(b"authorization", b"Bearer wrong-token")]
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/mcp/sse",
        "headers": headers,
    }
    request = Request(scope)

    with pytest.raises(MCPAuthError) as exc_info:
        await verify_mcp_token(request)

    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_verify_mcp_token_correct_secret():
    """verify_mcp_token succeeds with the correct MCP_ADMIN_SECRET."""
    from starlette.requests import Request
    from app.config import settings

    token_bytes = f"Bearer {settings.MCP_ADMIN_SECRET}".encode()
    headers = [(b"authorization", token_bytes)]
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/mcp/sse",
        "headers": headers,
    }
    request = Request(scope)
    # Should not raise
    await verify_mcp_token(request)


@pytest.mark.asyncio
async def test_verify_mcp_token_malformed_header():
    """Non-Bearer authorization scheme raises 401."""
    from starlette.requests import Request

    headers = [(b"authorization", b"Basic dXNlcjpwYXNz")]
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/mcp/sse",
        "headers": headers,
    }
    request = Request(scope)

    with pytest.raises(MCPAuthError) as exc_info:
        await verify_mcp_token(request)

    assert exc_info.value.status_code == 401


# ---------------------------------------------------------------------------
# MCP JSON-RPC helpers
# ---------------------------------------------------------------------------

def test_rpc_result_structure():
    """_rpc_result builds correct JSON-RPC 2.0 result object."""
    result = _rpc_result("req-1", {"key": "value"})
    assert result["jsonrpc"] == "2.0"
    assert result["id"] == "req-1"
    assert result["result"] == {"key": "value"}


def test_rpc_error_structure():
    """_rpc_error builds correct JSON-RPC 2.0 error object."""
    error = _rpc_error("req-2", -32601, "Method not found")
    assert error["jsonrpc"] == "2.0"
    assert error["id"] == "req-2"
    assert error["error"]["code"] == -32601
    assert error["error"]["message"] == "Method not found"


def test_rpc_error_with_data():
    """_rpc_error includes optional data field when provided."""
    error = _rpc_error("req-3", -32600, "Invalid request", data={"field": "name"})
    assert error["error"]["data"] == {"field": "name"}


# ---------------------------------------------------------------------------
# MCP method handlers
# ---------------------------------------------------------------------------

def test_handle_initialize():
    """initialize method returns correct protocol version and server info."""
    response = handle_initialize("init-1", {"clientInfo": {"name": "test", "version": "0.1"}})
    assert response["result"]["protocolVersion"] == MCP_PROTOCOL_VERSION
    assert response["result"]["serverInfo"]["name"] == SERVER_INFO["name"]
    assert "tools" in response["result"]["capabilities"]


def test_handle_tools_list():
    """tools/list returns all defined tools."""
    response = handle_tools_list("list-1", {})
    tools = response["result"]["tools"]
    assert isinstance(tools, list)
    assert len(tools) >= 3  # Expect at least 3 tools


def test_tool_definitions_have_required_fields():
    """Each tool definition must have name, description, and inputSchema."""
    for tool in TOOL_DEFINITIONS:
        assert "name" in tool, f"Tool missing name: {tool}"
        assert "description" in tool, f"Tool {tool.get('name')} missing description"
        assert "inputSchema" in tool, f"Tool {tool.get('name')} missing inputSchema"


def test_tool_handlers_match_definitions():
    """Every tool definition should have a corresponding handler."""
    defined_names = {t["name"] for t in TOOL_DEFINITIONS}
    handler_names = set(TOOL_HANDLERS.keys())
    assert defined_names == handler_names, (
        f"Mismatch: definitions-only={defined_names - handler_names}, "
        f"handlers-only={handler_names - defined_names}"
    )


# ---------------------------------------------------------------------------
# MCP HTTP endpoint tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_mcp_messages_without_auth(client):
    """MCP messages endpoint returns 401 without Authorization header."""
    fake_session = str(uuid.uuid4())
    resp = await client.post(
        f"/mcp/messages/{fake_session}",
        json={"jsonrpc": "2.0", "id": 1, "method": "ping", "params": {}},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_mcp_messages_with_wrong_secret(client):
    """MCP messages endpoint returns 403 with wrong token."""
    from app.config import settings

    fake_session = str(uuid.uuid4())
    resp = await client.post(
        f"/mcp/messages/{fake_session}",
        json={"jsonrpc": "2.0", "id": 1, "method": "ping", "params": {}},
        headers={"Authorization": "Bearer wrong-secret"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_mcp_messages_session_not_found(client):
    """MCP messages endpoint returns 404 for non-existent session."""
    from app.config import settings

    fake_session = str(uuid.uuid4())
    resp = await client.post(
        f"/mcp/messages/{fake_session}",
        json={"jsonrpc": "2.0", "id": 1, "method": "ping", "params": {}},
        headers={"Authorization": f"Bearer {settings.MCP_ADMIN_SECRET}"},
    )
    assert resp.status_code == 404
