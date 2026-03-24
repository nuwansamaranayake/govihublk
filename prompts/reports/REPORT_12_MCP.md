# Report 12 — MCP Endpoints

**Prompt:** 12_MCP_ENDPOINTS.md
**Date:** 2026-03-23
**Status:** Complete

---

## Summary

Implemented a full Model Context Protocol (MCP) SSE server for GoviHub, exposing 10 agricultural data tools to external AI clients (e.g. Claude Desktop, Cursor). All traffic is protected by a Bearer token verified against `settings.MCP_ADMIN_SECRET`.

---

## Files Created / Modified

| Path | Action | Description |
|------|--------|-------------|
| `govihub-api/app/mcp/auth.py` | Created | `verify_mcp_token(request)` — checks `Authorization: Bearer` header against `MCP_ADMIN_SECRET`; raises `MCPAuthError(401)` if header is missing/malformed, `MCPAuthError(403)` if token is wrong |
| `govihub-api/app/mcp/tools.py` | Created | `TOOL_DEFINITIONS` list (10 tools) + `TOOL_HANDLERS` dispatch dict with async DB-querying handlers |
| `govihub-api/app/mcp/server.py` | Created | FastAPI `APIRouter` with SSE + message endpoints; session management via in-process dict + `asyncio.Queue` |
| `govihub-api/app/mcp/router.py` | Created | Thin re-export shim: `from app.mcp.server import router` |
| `govihub-api/app/main.py` | Modified | Uncommented MCP router import and `app.include_router(mcp_router, prefix="/mcp", tags=["MCP"])` |

---

## MCP Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/mcp/sse` | SSE stream — opens a session, sends `event: endpoint` with the POST URL, then streams server-push responses and keepalive comments every 30 s |
| `POST` | `/mcp/messages/{session_id}` | JSON-RPC 2.0 dispatcher — handles `initialize`, `tools/list`, `tools/call`, `ping`, `notifications/initialized` |

Both endpoints require `Authorization: Bearer <MCP_ADMIN_SECRET>`.

---

## Tool Definitions (10 Tools)

| # | Tool Name | Description |
|---|-----------|-------------|
| 1 | `search_farmers` | Search farmer profiles by district, province, crop, irrigation type |
| 2 | `search_listings` | Search harvest listings and demand postings with multi-filter support |
| 3 | `get_match_analytics` | Match status breakdown, avg score, top crops, conversion rate |
| 4 | `get_price_trends` | Weekly avg/min/max price-per-kg trends for a given crop |
| 5 | `get_diagnosis_insights` | Top diseases, confidence metrics, user feedback distribution |
| 6 | `get_weather_summary` | Cached weather advisory alerts for a district/province |
| 7 | `get_platform_stats` | Platform-wide KPIs: users, listings, matches, diagnoses, advisory Q&A |
| 8 | `search_knowledge_base` | Full-text search (PostgreSQL tsvector) across knowledge chunks |
| 9 | `get_farmer_profile` | Detailed farmer profile including listings count and match history |
| 10 | `get_supply_chain_overview` | Supply listing category summary and top suppliers |

Each tool definition follows the MCP `inputSchema` (JSON Schema) specification.

---

## Architecture Details

### Auth (`mcp/auth.py`)
- `verify_mcp_token(request: Request) -> None` — awaitable, raises `MCPAuthError` (not a `GoviHubException`) to avoid polluting app exception handler
- `MCPAuthError(status_code, detail)` — handled inline in each route with `ORJSONResponse`

### Session Management (`mcp/server.py`)
- `_SESSIONS: dict[str, dict]` — in-process store keyed by UUID session ID
- Each session holds an `asyncio.Queue` for server→client pushes and an `active` flag
- Sessions are cleaned up in the `finally` block of the SSE generator

### JSON-RPC Flow
```
Client                              Server
  |-- GET /mcp/sse (Bearer) ------->|
  |<-- event: endpoint /mcp/... ----|
  |                                 |
  |-- POST /mcp/messages/{sid} ---->|  { "method": "initialize", ... }
  |<-- 200 JSON-RPC result ---------|  (also pushed onto SSE stream)
  |<-- event: message (SSE) --------|
  |                                 |
  |-- POST /mcp/messages/{sid} ---->|  { "method": "tools/list" }
  |<-- 200 { tools: [...] } --------|
  |                                 |
  |-- POST /mcp/messages/{sid} ---->|  { "method": "tools/call", "params": { "name": "get_platform_stats" } }
  |<-- 200 { content: [{ text }] } -|
```

### Tool Handler Pattern
All handlers are `async def _handle_<name>(params: dict) -> dict` and use `async_session_factory()` directly (no FastAPI `Depends`), making them callable both from the MCP layer and any future background tasks.

---

## Error Handling

| Scenario | Response |
|----------|----------|
| Missing / malformed Authorization header | HTTP 401 `{"error": "Missing Authorization header"}` |
| Wrong token | HTTP 403 `{"error": "Invalid MCP admin token"}` |
| Unknown session ID | HTTP 404 `{"error": "Session ... not found or expired"}` |
| Invalid JSON body | HTTP 400, JSON-RPC error code -32700 |
| Unknown method | HTTP 200, JSON-RPC error code -32601 |
| Unknown tool name | HTTP 200, JSON-RPC error code -32601 with available tool list |
| Tool handler exception | HTTP 200, `isError: true` result with error message (no 500 leak) |

---

## Notes

- The `get_weather_summary` handler gracefully falls back to an empty advisory list if the `alerts` table does not yet exist (e.g. in test environments where migrations have not been applied).
- `MCP_ADMIN_SECRET` defaults to `"change-me"` in `config.py` and must be overridden via the `.env` file in production.
- The SSE keepalive interval is 30 seconds, compatible with typical proxy/load-balancer idle timeouts.
- Protocol version advertised: `2024-11-05` (stable MCP spec).
