"""GoviHub API — FastAPI Application Factory."""

import time
import uuid
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse
from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Receive, Scope, Send

from app.config import settings
from app.database import engine
from app.exceptions import GoviHubException, govihub_exception_handler

logger = structlog.get_logger()


async def _matching_scheduler():
    """Run batch matching every 5 minutes in the background."""
    import asyncio

    await asyncio.sleep(30)  # initial delay — let app fully start
    while True:
        try:
            from scripts.run_matching import run_batch_matching

            count = await run_batch_matching()
            if count:
                logger.info("matching_scheduler_cycle", new_matches=count)
        except Exception as e:
            logger.error("matching_scheduler_error", error=str(e))
        await asyncio.sleep(300)  # 5 minutes


async def _weather_alert_scheduler():
    """Generate weather alerts for farmers every 60 minutes."""
    import asyncio

    await asyncio.sleep(60)  # initial delay
    while True:
        try:
            from app.weather.alert_engine import generate_alerts_for_all_farmers

            count = await generate_alerts_for_all_farmers()
            if count:
                logger.info("weather_alert_cycle", new_alerts=count)
        except Exception as e:
            logger.error("weather_alert_scheduler_error", error=str(e))
        await asyncio.sleep(3600)  # 60 minutes


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("govihub_starting", version="1.0.0", env=settings.APP_ENV)

    # Diagnosis now uses Gemini 2.0 Flash via OpenRouter — no CNN model to load.
    logger.info("diagnosis_engine", model="gemini-2.0-flash-001", note="via OpenRouter")

    # Load embedding model for the advisory RAG module.
    # Runs in a thread pool to avoid blocking the event loop during I/O.
    import asyncio
    from app.advisory.embeddings import embedding_service

    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, embedding_service.load_model)
    logger.info("embedding_model_ready", placeholder_mode=embedding_service.is_placeholder)

    # Start the periodic matching scheduler as a background task
    matching_task = asyncio.create_task(_matching_scheduler())
    logger.info("matching_scheduler_started", interval_seconds=300)

    # Start the weather alert scheduler
    weather_alert_task = asyncio.create_task(_weather_alert_scheduler())
    logger.info("weather_alert_scheduler_started", interval_seconds=3600)

    yield

    # Shutdown: cancel schedulers and dispose engine
    matching_task.cancel()
    weather_alert_task.cancel()
    await engine.dispose()
    logger.info("govihub_shutdown")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title="GoviHub API",
        description="AI-driven smart farming marketplace for Sri Lanka",
        version="1.0.0",
        default_response_class=ORJSONResponse,
        lifespan=lifespan,
        docs_url="/api/v1/docs",
        redoc_url="/api/v1/redoc",
        openapi_url="/api/v1/openapi.json",
    )

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Exception handlers
    app.add_exception_handler(GoviHubException, govihub_exception_handler)

    # Log validation errors with request body for debugging
    from fastapi.exceptions import RequestValidationError
    from starlette.requests import Request
    from starlette.responses import JSONResponse
    import structlog
    _val_log = structlog.get_logger("validation_error")

    @app.exception_handler(RequestValidationError)
    async def log_validation_error(request: Request, exc: RequestValidationError):
        body = None
        try:
            body = await request.body()
            body = body.decode("utf-8")[:500]
        except Exception:
            pass
        # Strip non-JSON-serializable context (e.g. raw ValueError instances
        # emitted by custom field_validator callables in Pydantic v2).
        safe_errors = [
            {"loc": list(e.get("loc", [])), "msg": e.get("msg"), "type": e.get("type")}
            for e in exc.errors()
        ]
        _val_log.warning(
            "validation_error",
            path=str(request.url.path),
            method=request.method,
            body=body,
            errors=safe_errors,
        )
        return JSONResponse(status_code=422, content={"detail": safe_errors})

    # Request ID + Logging middleware — pure ASGI to avoid Content-Length
    # mismatch with ORJSONResponse when using call_next() buffering.
    class RequestLoggingMiddleware:
        def __init__(self, asgi_app: ASGIApp) -> None:
            self.app = asgi_app

        async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
            if scope["type"] != "http":
                await self.app(scope, receive, send)
                return

            raw_headers = dict(scope.get("headers", []))
            request_id = raw_headers.get(
                b"x-request-id", str(uuid.uuid4()).encode()
            ).decode()
            start_time = time.perf_counter()
            scope.setdefault("state", {})["request_id"] = request_id
            status_code = 500

            async def send_wrapper(message: dict) -> None:
                nonlocal status_code
                if message["type"] == "http.response.start":
                    status_code = message["status"]
                    MutableHeaders(scope=message).append("X-Request-ID", request_id)
                elif message["type"] == "http.response.body" and not message.get("more_body"):
                    duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
                    logger.info(
                        "http_request",
                        method=scope.get("method", ""),
                        path=scope.get("path", ""),
                        status=status_code,
                        duration_ms=duration_ms,
                        request_id=request_id,
                    )
                await send(message)

            await self.app(scope, receive, send_wrapper)

    app.add_middleware(RequestLoggingMiddleware)

    # Health check
    @app.get("/api/v1/health", tags=["Health"])
    async def health_check():
        from datetime import datetime, timezone

        return {
            "status": "healthy",
            "version": "1.0.0",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    # Module routers
    from app.auth.router import router as auth_router
    from app.users.router import router as users_router
    from app.listings.router import router as listings_router
    from app.matching.router import router as matching_router
    from app.diagnosis.router import router as diagnosis_router
    from app.advisory.router import router as advisory_router
    from app.marketplace.router import router as marketplace_router
    from app.alerts.router import router as alerts_router
    from app.notifications.router import router as notifications_router
    from app.admin.router import router as admin_router
    from app.mcp.router import router as mcp_router
    from app.sector.router import router as sector_router
    from app.weather.router import router as weather_router
    from app.ads.router import router as ads_router

    app.include_router(auth_router, prefix="/api/v1/auth", tags=["Auth"])
    app.include_router(users_router, prefix="/api/v1/users", tags=["Users"])
    # Single router handles /api/v1/crops, /api/v1/districts (reference data)
    # AND /api/v1/listings/harvest, /api/v1/listings/demand (Listings CRUD)
    app.include_router(listings_router, prefix="/api/v1", tags=["Listings"])
    app.include_router(matching_router, prefix="/api/v1/matches", tags=["Matching"])
    app.include_router(diagnosis_router, prefix="/api/v1/diagnosis", tags=["Diagnosis"])
    app.include_router(advisory_router, prefix="/api/v1/advisory", tags=["Advisory"])
    app.include_router(marketplace_router, prefix="/api/v1/marketplace", tags=["Marketplace"])
    app.include_router(alerts_router, prefix="/api/v1/alerts", tags=["Alerts"])
    app.include_router(notifications_router, prefix="/api/v1/notifications", tags=["Notifications"])
    app.include_router(admin_router, prefix="/api/v1/admin", tags=["Admin"])
    app.include_router(mcp_router, prefix="/mcp", tags=["MCP"])
    app.include_router(sector_router, prefix="/api/v1", tags=["Sector"])
    app.include_router(weather_router, prefix="/api/v1/weather", tags=["Weather"])
    app.include_router(ads_router, prefix="/api/v1", tags=["Advertisements"])

    # Beta auth — username/password login for beta testing
    if settings.APP_ENV in ("beta", "development"):
        from app.auth.beta_router import router as beta_auth_router
        app.include_router(beta_auth_router, prefix="/api/v1/auth", tags=["Beta Auth"])
        logger.info("beta_auth_enabled", note="Username/password login is active")

        # Beta feedback endpoint
        from app.feedback.router import router as feedback_router
        app.include_router(feedback_router, prefix="/api/v1", tags=["Feedback"])

    # Dev auth bypass — only in development mode
    if settings.APP_ENV == "development":
        from app.auth.dev_router import router as dev_auth_router
        app.include_router(dev_auth_router, prefix="/api/v1/auth", tags=["Dev Auth"])
        logger.warning("dev_auth_enabled", note="Development-only login bypass is active")

    # Serve /uploads/ as static files (local fallback for R2 image storage)
    from pathlib import Path
    uploads_dir = Path("/app/uploads")
    if uploads_dir.is_dir():
        from fastapi.staticfiles import StaticFiles
        app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")
        logger.info("static_uploads_mounted", path=str(uploads_dir))

    return app


app = create_app()
