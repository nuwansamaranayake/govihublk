"""GoviHub Test Configuration — Fixtures for async tests, factory objects, and mocks."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import AsyncGenerator, Optional
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.auth.service import create_access_token, _hash_token
from app.database import Base
from app.main import create_app

# ---------------------------------------------------------------------------
# Test database — SQLite in-memory for lightweight unit/integration tests
# ---------------------------------------------------------------------------

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture(scope="session")
async def engine():
    """Create a session-scoped in-memory SQLite engine."""
    import os
    os.environ.setdefault("DATABASE_URL", TEST_DATABASE_URL)
    os.environ.setdefault("REDIS_URL", "redis://localhost:6379/15")
    os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-testing-only")
    os.environ.setdefault("MCP_ADMIN_SECRET", "test-mcp-secret")

    test_engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
        connect_args={"check_same_thread": False},
    )

    # Create all tables
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield test_engine

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await test_engine.dispose()


@pytest_asyncio.fixture
async def db_session(engine) -> AsyncGenerator[AsyncSession, None]:
    """Provide a transactional test database session that rolls back after each test."""
    session_factory = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with session_factory() as session:
        yield session
        await session.rollback()


# ---------------------------------------------------------------------------
# App + HTTP client
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def app(db_session):
    """Create a test FastAPI application with DB override."""
    from app.dependencies import get_db

    test_app = create_app()

    async def override_get_db():
        yield db_session

    test_app.dependency_overrides[get_db] = override_get_db
    return test_app


@pytest_asyncio.fixture
async def client(app) -> AsyncGenerator[AsyncClient, None]:
    """Async HTTP client against the test app."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as c:
        yield c


# ---------------------------------------------------------------------------
# JWT token fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def farmer_user_id() -> uuid.UUID:
    return uuid.uuid4()


@pytest.fixture
def buyer_user_id() -> uuid.UUID:
    return uuid.uuid4()


@pytest.fixture
def supplier_user_id() -> uuid.UUID:
    return uuid.uuid4()


@pytest.fixture
def admin_user_id() -> uuid.UUID:
    return uuid.uuid4()


@pytest.fixture
def farmer_token(farmer_user_id) -> str:
    return create_access_token(user_id=farmer_user_id, role="farmer")


@pytest.fixture
def buyer_token(buyer_user_id) -> str:
    return create_access_token(user_id=buyer_user_id, role="buyer")


@pytest.fixture
def supplier_token(supplier_user_id) -> str:
    return create_access_token(user_id=supplier_user_id, role="supplier")


@pytest.fixture
def admin_token(admin_user_id) -> str:
    return create_access_token(user_id=admin_user_id, role="admin")


def auth_header(token: str) -> dict:
    """Build authorization header dict for httpx requests."""
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# Database factory fixtures
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def farmer_user(db_session: AsyncSession):
    """Create a test farmer user in the database."""
    from app.users.models import User, UserRole, FarmerProfile

    user = User(
        id=uuid.uuid4(),
        email=f"farmer_{uuid.uuid4().hex[:8]}@test.lk",
        name="Test Farmer",
        role=UserRole.farmer,
        language="si",
        is_active=True,
        is_verified=True,
        district="Colombo",
    )
    db_session.add(user)
    await db_session.flush()

    profile = FarmerProfile(
        user_id=user.id,
        farm_size_acres=5.0,
        primary_crops=["tomato", "rice"],
        irrigation_type="drip",
    )
    db_session.add(profile)
    await db_session.flush()

    return user


@pytest_asyncio.fixture
async def buyer_user(db_session: AsyncSession):
    """Create a test buyer user in the database."""
    from app.users.models import User, UserRole, BuyerProfile

    user = User(
        id=uuid.uuid4(),
        email=f"buyer_{uuid.uuid4().hex[:8]}@test.lk",
        name="Test Buyer",
        role=UserRole.buyer,
        language="en",
        is_active=True,
        is_verified=True,
        district="Kandy",
    )
    db_session.add(user)
    await db_session.flush()

    profile = BuyerProfile(
        user_id=user.id,
        business_name="Fresh Produce Ltd",
        business_type="wholesaler",
        preferred_radius_km=100,
    )
    db_session.add(profile)
    await db_session.flush()

    return user


@pytest_asyncio.fixture
async def supplier_user(db_session: AsyncSession):
    """Create a test supplier user in the database."""
    from app.users.models import User, UserRole, SupplierProfile

    user = User(
        id=uuid.uuid4(),
        email=f"supplier_{uuid.uuid4().hex[:8]}@test.lk",
        name="Test Supplier",
        role=UserRole.supplier,
        language="ta",
        is_active=True,
        is_verified=True,
        district="Jaffna",
    )
    db_session.add(user)
    await db_session.flush()

    profile = SupplierProfile(
        user_id=user.id,
        business_name="AgroSupply Lanka",
        categories=["seeds", "fertilizer"],
        contact_phone="+94771234567",
    )
    db_session.add(profile)
    await db_session.flush()

    return user


@pytest_asyncio.fixture
async def admin_user(db_session: AsyncSession):
    """Create a test admin user in the database."""
    from app.users.models import User, UserRole

    user = User(
        id=uuid.uuid4(),
        email=f"admin_{uuid.uuid4().hex[:8]}@govihub.lk",
        name="Admin User",
        role=UserRole.admin,
        language="en",
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.flush()

    return user


@pytest_asyncio.fixture
async def crop_taxonomy(db_session: AsyncSession):
    """Create a test crop taxonomy entry."""
    from app.listings.models import CropTaxonomy, CropCategory

    crop = CropTaxonomy(
        id=uuid.uuid4(),
        code=f"TEST_{uuid.uuid4().hex[:6].upper()}",
        name_en="Tomato",
        name_si="තක්කාලි",
        name_ta="தக்காளி",
        category=CropCategory.vegetable,
        avg_yield_kg=15000.0,
        is_active=True,
    )
    db_session.add(crop)
    await db_session.flush()

    return crop


@pytest_asyncio.fixture
async def harvest_listing(db_session: AsyncSession, farmer_user, crop_taxonomy):
    """Create a test harvest listing."""
    from app.listings.models import HarvestListing, ListingStatus

    listing = HarvestListing(
        id=uuid.uuid4(),
        farmer_id=farmer_user.id,
        crop_id=crop_taxonomy.id,
        variety="Cherry Tomato",
        quantity_kg=500.0,
        price_per_kg=120.0,
        quality_grade="A",
        harvest_date=date.today(),
        available_from=date.today(),
        available_until=date.today() + timedelta(days=30),
        status=ListingStatus.active,
        is_organic=True,
        delivery_available=True,
        delivery_radius_km=50,
    )
    db_session.add(listing)
    await db_session.flush()

    return listing


@pytest_asyncio.fixture
async def demand_posting(db_session: AsyncSession, buyer_user, crop_taxonomy):
    """Create a test demand posting."""
    from app.listings.models import DemandPosting, DemandStatus

    demand = DemandPosting(
        id=uuid.uuid4(),
        buyer_id=buyer_user.id,
        crop_id=crop_taxonomy.id,
        quantity_kg=300.0,
        max_price_per_kg=150.0,
        quality_grade="A",
        needed_by=date.today() + timedelta(days=14),
        radius_km=100,
        status=DemandStatus.active,
    )
    db_session.add(demand)
    await db_session.flush()

    return demand


@pytest_asyncio.fixture
async def match_record(db_session: AsyncSession, harvest_listing, demand_posting):
    """Create a test match record."""
    from app.matching.models import Match, MatchStatus

    match = Match(
        id=uuid.uuid4(),
        harvest_id=harvest_listing.id,
        demand_id=demand_posting.id,
        score=0.82,
        score_breakdown={
            "distance_score": 0.9,
            "quantity_score": 0.8,
            "date_overlap_score": 0.85,
            "freshness_score": 1.0,
            "total": 0.82,
        },
        status=MatchStatus.proposed,
    )
    db_session.add(match)
    await db_session.flush()

    return match


@pytest_asyncio.fixture
async def supply_listing(db_session: AsyncSession, supplier_user):
    """Create a test supply listing."""
    from app.marketplace.models import SupplyListing, SupplyCategory, SupplyStatus

    listing = SupplyListing(
        id=uuid.uuid4(),
        supplier_id=supplier_user.id,
        name="Premium Tomato Seeds",
        name_si="ශ්‍රේෂ්ඨ තක්කාලි බීජ",
        description="High yield variety suitable for dry zone",
        category=SupplyCategory.seeds,
        price=450.0,
        unit="packet",
        stock_quantity=100,
        delivery_available=True,
        delivery_radius_km=200,
        status=SupplyStatus.active,
    )
    db_session.add(listing)
    await db_session.flush()

    return listing


@pytest_asyncio.fixture
async def notification(db_session: AsyncSession, farmer_user):
    """Create a test notification."""
    from app.notifications.models import Notification, NotificationType, NotificationChannel

    notif = Notification(
        id=uuid.uuid4(),
        user_id=farmer_user.id,
        type=NotificationType.match_found,
        channel=NotificationChannel.in_app,
        title="New Match Found",
        body="A buyer is interested in your tomatoes",
        is_read=False,
        is_sent=True,
    )
    db_session.add(notif)
    await db_session.flush()

    return notif


# ---------------------------------------------------------------------------
# Mock fixtures for external services
# ---------------------------------------------------------------------------

@pytest.fixture
def mock_openrouter():
    """Mock OpenRouter LLM client."""
    with patch("app.utils.openrouter.OpenRouterClient.chat") as mock:
        response = MagicMock()
        response.content = "This is a mock advisory response about crop disease management."
        response.model = "anthropic/claude-sonnet-4"
        response.usage = {"prompt_tokens": 100, "completion_tokens": 50}
        mock.return_value = response
        yield mock


@pytest.fixture
def mock_openweather():
    """Mock OpenWeather API calls."""
    with patch("httpx.AsyncClient.get") as mock:
        mock.return_value = MagicMock(
            status_code=200,
            json=lambda: {
                "weather": [{"main": "Clear", "description": "clear sky"}],
                "main": {"temp": 302.15, "humidity": 65},
                "wind": {"speed": 3.5},
                "name": "Colombo",
            },
        )
        yield mock


@pytest.fixture
def mock_fcm():
    """Mock Firebase Cloud Messaging."""
    with patch("firebase_admin.messaging.send") as mock:
        mock.return_value = "projects/test/messages/test123"
        yield mock


@pytest.fixture
def mock_sms():
    """Mock Twilio SMS client."""
    with patch("twilio.rest.Client.messages") as mock:
        mock.create.return_value = MagicMock(sid="SM123456", status="sent")
        yield mock


@pytest.fixture
def mock_embedding():
    """Mock embedding service to return fixed-dimension vectors."""
    with patch("app.advisory.embeddings.EmbeddingService.embed") as mock:
        # Return a 384-dim vector (all-MiniLM-L6-v2 dimension)
        mock.return_value = [0.1] * 384
        yield mock


@pytest.fixture
def mock_cnn():
    """Mock CNN model prediction."""
    with patch("app.diagnosis.cnn.CropDiseaseCNN.predict") as mock:
        mock.return_value = [
            {"label": "Tomato___Early_blight", "confidence": 0.85},
            {"label": "Tomato___Late_blight", "confidence": 0.10},
            {"label": "Tomato___healthy", "confidence": 0.05},
        ]
        yield mock
