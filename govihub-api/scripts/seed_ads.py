"""GoviHub Advertisement Seeder — 3 sample ads with realistic event data."""

import asyncio
import json
import random
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import structlog

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import app.models  # noqa: register all models
from app.database import async_session_factory
from sqlalchemy import text

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# Sample Advertisements
# ---------------------------------------------------------------------------

ADS = [
    {
        "title": "Premium Organic Fertilizer",
        "title_si": "ප්‍රිමියම් කාබනික පොහොර",
        "description": "Best for spice crops. Free delivery for 50kg+",
        "description_si": "කුළුබඩු බෝග සඳහා හොඳම. 50kg+ සඳහා නොමිලේ බෙදා හැරීම",
        "click_url": "https://example.com/organic-fertilizer",
        "target_roles": ["farmer", "buyer", "supplier"],
        "target_districts": [],
        "is_active": True,
        "starts_at": datetime.now(timezone.utc) - timedelta(days=30),
        "ends_at": None,
        "advertiser_name": "AgriCo Lanka (Pvt) Ltd",
        "advertiser_contact": "sales@agrico.lk",
        "display_order": 1,
        "image_url": "/uploads/ads/seed-fertilizer.jpg",
    },
    {
        "title": "DevPro Spice Farming Workshop",
        "title_si": "DevPro කුළුබඩු ගොවිතැන් වැඩමුළුව",
        "description": "Free 2-day workshop. Learn modern techniques.",
        "description_si": "දින 2 නොමිලේ වැඩමුළුව. නවීන ක්‍රම ඉගෙන ගන්න.",
        "click_url": "https://example.com/workshop",
        "target_roles": ["farmer"],
        "target_districts": ["Matale", "Kandy"],
        "is_active": True,
        "starts_at": datetime(2026, 5, 1, tzinfo=timezone.utc),
        "ends_at": datetime(2026, 5, 15, tzinfo=timezone.utc),
        "advertiser_name": "DevPro / OXFAM",
        "advertiser_contact": "workshops@devpro.lk",
        "display_order": 2,
        "image_url": "/uploads/ads/seed-workshop.jpg",
    },
    {
        "title": "GoviHub — Download the App",
        "title_si": "GoviHub — යෙදුම බාගන්න",
        "description": "Free for all Sri Lankan farmers",
        "description_si": "ශ්‍රී ලංකාවේ සියලු ගොවීන්ට නොමිලේ",
        "click_url": None,
        "target_roles": ["farmer", "buyer", "supplier"],
        "target_districts": [],
        "is_active": True,
        "starts_at": datetime.now(timezone.utc) - timedelta(days=60),
        "ends_at": None,
        "advertiser_name": "GoviHub",
        "advertiser_contact": None,
        "display_order": 3,
        "image_url": "/uploads/ads/seed-govihub.jpg",
    },
]

# ---------------------------------------------------------------------------
# Event generation config
# ---------------------------------------------------------------------------

DISTRICTS = ["Matale", "Kandy", "Anuradhapura", "Polonnaruwa", "Kurunegala"]
ROLES = ["farmer", "buyer", "supplier"]
PAGE_URLS = [
    "/si/farmer/dashboard",
    "/en/farmer/dashboard",
    "/si/buyer/dashboard",
    "/en/buyer/dashboard",
    "/si/supplier/dashboard",
]


def _random_events(ad_id: uuid.UUID, count: int) -> list[dict]:
    """Generate random ad events spread over the past 14 days."""
    now = datetime.now(timezone.utc)
    events = []
    for _ in range(count):
        is_click = random.random() < 0.20  # 20% clicks, 80% impressions
        created = now - timedelta(
            days=random.uniform(0, 14),
            hours=random.uniform(0, 23),
            minutes=random.uniform(0, 59),
        )
        events.append(
            {
                "id": str(uuid.uuid4()),
                "ad_id": str(ad_id),
                "event_type": "click" if is_click else "impression",
                "user_role": random.choice(ROLES),
                "user_district": random.choice(DISTRICTS),
                "page_url": random.choice(PAGE_URLS),
                "created_at": created,
                "updated_at": created,
            }
        )
    return events


# ---------------------------------------------------------------------------
# Image generation (optional — uses Pillow if available)
# ---------------------------------------------------------------------------

def _try_generate_images():
    """Generate simple placeholder banner images (800x450). Skip if Pillow missing."""
    try:
        from PIL import Image, ImageDraw, ImageFont  # type: ignore
    except ImportError:
        logger.info("Pillow not installed — skipping placeholder image generation")
        return

    upload_dir = Path(__file__).resolve().parent.parent / "uploads" / "ads"
    upload_dir.mkdir(parents=True, exist_ok=True)

    banners = [
        ("seed-fertilizer.jpg", "Premium Organic\nFertilizer", "#2E7D32", "#FFFFFF"),
        ("seed-workshop.jpg", "Spice Farming\nWorkshop", "#1565C0", "#FFFFFF"),
        ("seed-govihub.jpg", "GoviHub\nDownload the App", "#F9A825", "#1B5E20"),
    ]

    for filename, label, bg_color, text_color in banners:
        filepath = upload_dir / filename
        if filepath.exists():
            logger.info(f"Image already exists, skipping: {filepath}")
            continue

        img = Image.new("RGB", (800, 450), bg_color)
        draw = ImageDraw.Draw(img)

        # Try to use a decent font size; fall back to default
        try:
            font = ImageFont.truetype("arial.ttf", 48)
        except (OSError, IOError):
            font = ImageFont.load_default()

        # Center text
        bbox = draw.multiline_textbbox((0, 0), label, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
        x = (800 - text_w) // 2
        y = (450 - text_h) // 2
        draw.multiline_text((x, y), label, fill=text_color, font=font, align="center")

        img.save(str(filepath), "JPEG", quality=85)
        logger.info(f"Generated placeholder image: {filepath}")


# ---------------------------------------------------------------------------
# Main seeder
# ---------------------------------------------------------------------------

async def seed_ads():
    """Seed sample advertisements and events."""
    async with async_session_factory() as session:
        # Idempotency check
        result = await session.execute(text("SELECT COUNT(*) FROM advertisements"))
        count = result.scalar()
        if count and count > 0:
            logger.info(f"Advertisements table already has {count} rows — skipping seed")
            return

        logger.info("Seeding advertisements...")

        ad_ids = []
        for ad in ADS:
            ad_id = uuid.uuid4()
            ad_ids.append(ad_id)

            await session.execute(
                text("""
                    INSERT INTO advertisements (
                        id, title, title_si, description, description_si,
                        image_url, click_url,
                        target_roles, target_districts,
                        is_active, starts_at, ends_at,
                        advertiser_name, advertiser_contact,
                        display_order, impression_count, click_count,
                        created_at, updated_at
                    ) VALUES (
                        :id, :title, :title_si, :description, :description_si,
                        :image_url, :click_url,
                        CAST(:target_roles AS jsonb), CAST(:target_districts AS jsonb),
                        :is_active, :starts_at, :ends_at,
                        :advertiser_name, :advertiser_contact,
                        :display_order, 0, 0,
                        NOW(), NOW()
                    )
                """),
                {
                    "id": str(ad_id),
                    "title": ad["title"],
                    "title_si": ad["title_si"],
                    "description": ad["description"],
                    "description_si": ad["description_si"],
                    "image_url": ad["image_url"],
                    "click_url": ad["click_url"],
                    "target_roles": json.dumps(ad["target_roles"]),
                    "target_districts": json.dumps(ad["target_districts"]),
                    "is_active": ad["is_active"],
                    "starts_at": ad["starts_at"],
                    "ends_at": ad["ends_at"],
                    "advertiser_name": ad["advertiser_name"],
                    "advertiser_contact": ad["advertiser_contact"],
                    "display_order": ad["display_order"],
                },
            )
            logger.info(f"  Created ad: {ad['title']}")

        # Generate events for each ad
        logger.info("Generating ad events...")
        for i, ad_id in enumerate(ad_ids):
            event_count = random.randint(50, 200)
            events = _random_events(ad_id, event_count)

            for evt in events:
                await session.execute(
                    text("""
                        INSERT INTO ad_events (
                            id, ad_id, event_type, user_role, user_district,
                            page_url, created_at, updated_at
                        ) VALUES (
                            :id, :ad_id, :event_type, :user_role, :user_district,
                            :page_url, :created_at, :updated_at
                        )
                    """),
                    evt,
                )

            # Count impressions and clicks for this ad
            impressions = sum(1 for e in events if e["event_type"] == "impression")
            clicks = sum(1 for e in events if e["event_type"] == "click")

            # Update denormalized counters
            await session.execute(
                text("""
                    UPDATE advertisements
                    SET impression_count = :impressions,
                        click_count = :clicks
                    WHERE id = :ad_id
                """),
                {
                    "impressions": impressions,
                    "clicks": clicks,
                    "ad_id": str(ad_id),
                },
            )
            logger.info(
                f"  Ad '{ADS[i]['title']}': {event_count} events "
                f"({impressions} impressions, {clicks} clicks)"
            )

        await session.commit()
        logger.info("Advertisement seeding complete!")


def main():
    """Entry point."""
    # Try generating placeholder images first
    _try_generate_images()

    # Seed database
    asyncio.run(seed_ads())


if __name__ == "__main__":
    main()
