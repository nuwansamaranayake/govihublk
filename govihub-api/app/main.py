"""GoviHub API — FastAPI Application Factory."""

import time
import uuid
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse

from app.config import settings
from app.database import engine
from app.exceptions import GoviHubException, govihub_exception_handler

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("govihub_starting", version="1.0.0", env=settings.APP_ENV)

    # Load CNN model at startup (falls back to placeholder if .pt file is absent)
    from app.diagnosis.cnn import cnn_model
    cnn_model.load_model()
    logger.info("cnn_model_ready", placeholder_mode=cnn_model._placeholder_mode)

    # Load embedding model for the advisory RAG module.
    # Runs in a thread pool to avoid blocking the event loop during I/O.
    import asyncio
    from app.advisory.embeddings import embedding_service

    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, embedding_service.load_model)
    logger.info("embedding_model_ready", placeholder_mode=embedding_service.is_placeholder)

    yield

    # Shutdown: dispose engine
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

    # Request ID + Logging middleware
    @app.middleware("http")
    async def request_logging_middleware(request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request.state.request_id = request_id
        start_time = time.perf_counter()

        response = await call_next(request)

        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        response.headers["X-Request-ID"] = request_id

        logger.info(
            "http_request",
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            duration_ms=duration_ms,
            request_id=request_id,
        )
        return response

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

    return app


app = create_app()
