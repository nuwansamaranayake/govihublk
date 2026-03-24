# Prompt 12 — MCP (Model Context Protocol) Endpoints

## Context
All backend modules are complete. Now expose MCP endpoints so Claude or other AI systems can retrieve GoviHub data for analysis and processing.

## Objective
Implement MCP SSE (Server-Sent Events) server with admin-only access. Define tools that allow AI systems to query users, listings, matches, diagnoses, prices, and analytics. Farmers, buyers, and suppliers have NO access to MCP.

## Design Principles
- MCP follows the Model Context Protocol specification (SSE transport)
- Authentication: Bearer token with `MCP_ADMIN_SECRET` (not user JWT)
- All tools are read-only data retrieval (no mutations via MCP)
- Tools return structured JSON that AI systems can reason over
- Rate limited: 100 requests/minute

## Instructions

### 1. app/mcp/server.py — MCP SSE Server

Implement a lightweight MCP server following the protocol spec:

```python
"""
GoviHub MCP Server
Exposes agricultural data as MCP tools for AI system consumption.
Transport: SSE (Server-Sent Events)
Auth: Bearer token (MCP_ADMIN_SECRET)
"""

from fastapi import APIRouter, Request, Depends
from fastapi.responses import StreamingResponse
import json
import asyncio

router = APIRouter()

# MCP Protocol messages
async def handle_initialize(params):
    return {
        "protocolVersion": "2024-11-05",
        "capabilities": {"tools": {"listChanged": False}},
        "serverInfo": {"name": "govihub-mcp", "version": "1.0.0"}
    }

async def handle_tools_list():
    return {"tools": TOOL_DEFINITIONS}

async def handle_tool_call(name, arguments, db):
    handler = TOOL_HANDLERS.get(name)
    if not handler:
        raise ValueError(f"Unknown tool: {name}")
    return await handler(arguments, db)
```

### 2. app/mcp/auth.py — MCP Authentication

```python
async def verify_mcp_token(request: Request):
    """
    Verify MCP admin secret token.
    NOT the same as user JWT auth.
    Only platform admins with the MCP_ADMIN_SECRET can connect.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(401, "MCP authentication required")
    
    token = auth_header[7:]
    if token != settings.MCP_ADMIN_SECRET:
        raise HTTPException(403, "Invalid MCP credentials")
```

### 3. app/mcp/tools.py — Tool Definitions & Handlers

Define these MCP tools:

**1. search_farmers**
- Description: "Search registered farmers by district, crops, and activity"
- Parameters: district (opt), crop_id (opt), is_active (opt), min_listings (opt int), limit (opt, default 20)
- Returns: List of farmer summaries (id, name, district, primary_crops, total_listings, total_matches, last_active)

**2. search_listings**
- Description: "Search harvest listings and demand postings with filters"
- Parameters: type (harvest/demand), crop_id (opt), status (opt), district (opt), date_from (opt), date_to (opt), limit (opt)
- Returns: List of listings with crop name, quantity, status, location, dates

**3. get_match_analytics**
- Description: "Get matching engine analytics: scores, fulfillment rates, top crops"
- Parameters: date_from (opt), date_to (opt), district (opt)
- Returns: Total matches, by status breakdown, avg score, fulfillment rate, top matched crops, avg time to fulfillment

**4. get_price_trends**
- Description: "Get market price trends for agricultural commodities"
- Parameters: crop_id (opt), market (opt), days (opt, default 30)
- Returns: Price time series with date, price, market, and computed trend direction

**5. get_diagnosis_insights**
- Description: "Get crop disease diagnosis statistics and patterns"
- Parameters: crop_id (opt), district (opt), date_from (opt), date_to (opt)
- Returns: Top diseases detected, confidence distribution, feedback stats, disease trends over time

**6. get_weather_summary**
- Description: "Get weather conditions and alerts across monitored regions"
- Parameters: district (opt)
- Returns: Current conditions, active alerts, forecast summary by region

**7. get_platform_stats**
- Description: "Get overall platform health and usage statistics"
- Parameters: (none)
- Returns: User counts by role, active listings, match pipeline stats, system health metrics

**8. search_knowledge_base**
- Description: "Search the agricultural knowledge base using semantic similarity"
- Parameters: query (str), language (si/en), limit (opt, default 5)
- Returns: Matching knowledge chunks with similarity scores, source attribution

**9. get_farmer_profile**
- Description: "Get detailed farmer profile including activity history"
- Parameters: farmer_id (UUID)
- Returns: Full farmer profile, recent listings, match history, diagnosis history

**10. get_supply_chain_overview**
- Description: "Get supply chain overview: active demands, available harvests, potential matches"
- Parameters: crop_id (opt), district (opt)
- Returns: Summary of supply/demand balance, gap analysis, geographical distribution

### 4. MCP SSE Endpoints

```python
@router.get("/mcp/sse")
async def mcp_sse_endpoint(request: Request, db = Depends(get_db)):
    """
    SSE endpoint for MCP protocol communication.
    Client connects via GET, sends messages via POST to /mcp/messages.
    """
    # Verify MCP auth
    await verify_mcp_token(request)
    
    # Create SSE stream
    async def event_generator():
        # Send endpoint URL for client to POST messages to
        yield f"event: endpoint\ndata: /mcp/messages/{session_id}\n\n"
        
        # Keep connection alive
        while True:
            if await request.is_disconnected():
                break
            # Send response messages as they become available
            # ... message queue handling
            await asyncio.sleep(1)
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
    )

@router.post("/mcp/messages/{session_id}")
async def mcp_message_handler(session_id: str, request: Request, db = Depends(get_db)):
    """Handle incoming MCP messages (initialize, tools/list, tools/call)."""
    await verify_mcp_token(request)
    body = await request.json()
    
    method = body.get("method")
    params = body.get("params", {})
    
    if method == "initialize":
        result = await handle_initialize(params)
    elif method == "tools/list":
        result = await handle_tools_list()
    elif method == "tools/call":
        result = await handle_tool_call(params["name"], params.get("arguments", {}), db)
    else:
        raise HTTPException(400, f"Unsupported method: {method}")
    
    return {"jsonrpc": "2.0", "id": body.get("id"), "result": result}
```

### 5. Security: Explicit Role Blocking

Add a middleware or check that ensures regular user JWT tokens CANNOT access `/mcp/*` endpoints:

```python
@router.middleware("http")
async def block_regular_users(request: Request, call_next):
    """
    MCP endpoints are ONLY for admin AI integration.
    Regular users (farmer, buyer, supplier) are explicitly blocked.
    """
    # Check if this is a user JWT (not MCP token)
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        try:
            payload = decode_access_token(auth[7:])
            if payload.get("role") in ("farmer", "buyer", "supplier"):
                raise HTTPException(403, "MCP access is restricted to platform administrators")
        except:
            pass  # Not a valid JWT, will be checked by MCP auth
    
    return await call_next(request)
```

### 6. Register MCP Router

Add to main.py with prefix `/mcp` (no `/api/v1` prefix — MCP has its own URL space):
```python
from app.mcp.server import router as mcp_router
app.include_router(mcp_router, tags=["mcp"])
```

### 7. MCP Documentation

Create `app/mcp/README.md` documenting:
- How to connect Claude Desktop or other MCP clients
- Available tools and their parameters
- Authentication setup
- Example MCP client configuration:
```json
{
  "mcpServers": {
    "govihub": {
      "url": "https://govihublk.com/mcp/sse",
      "headers": {
        "Authorization": "Bearer <MCP_ADMIN_SECRET>"
      }
    }
  }
}
```

## Verification

1. MCP SSE endpoint starts and accepts connections
2. Authentication rejects invalid tokens
3. Regular user JWTs are explicitly blocked from MCP
4. tools/list returns all 10 tool definitions
5. Each tool handler returns correctly structured data
6. Tool parameters are validated
7. Rate limiting is documented

## Output Report
Write report to: `/home/claude/govihub-prompts/reports/REPORT_12_MCP.md`
