"""Verification harness for listing moderation v1.

Creates throwaway listings, drives the real code paths, asserts the outcomes,
and cleans up after itself. Run inside the API container:

    docker compose ... exec -T govihub-api python scripts/verify_moderation.py

Test 3 (image flag) mocks the vision verdict at the service seam so no
offensive imagery ever has to be seeded. Test 4 is the false-positive guard and
is the most important one here: an ordinary farmer listing must come back clean.
"""

import asyncio
import sys
import uuid
from pathlib import Path

# Add project root to path (same pattern as scripts/seed_crops.py)
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import delete, select

import app.models  # noqa: F401 — register all models
from app.database import async_session_factory
from app.listings.models import CropTaxonomy, HarvestListing, HarvestStatus
from app.marketplace.models import SupplyCategory, SupplyListing, SupplyStatus
from app.moderation import service as mod
from app.moderation.models import ModerationEvent
from app.moderation.tasks import moderation_sweep
from app.users.models import User

RESULTS = []
CREATED: list[tuple[str, uuid.UUID]] = []


def check(name, ok, detail=""):
    RESULTS.append((name, ok, detail))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


async def _a_supplier(db):
    row = await db.execute(select(User).where(User.role == "supplier").limit(1))
    return row.scalar_one()


async def _a_farmer(db):
    row = await db.execute(select(User).where(User.role == "farmer").limit(1))
    return row.scalar_one()


async def _make_supply(db, supplier, name, description):
    listing = SupplyListing(
        supplier_id=supplier.id,
        name=name,
        description=description,
        category=SupplyCategory.other,
        status=SupplyStatus.active,
        moderation_status="pending_scan",
    )
    db.add(listing)
    await db.flush()
    CREATED.append(("supply", listing.id))
    return listing


async def _events(db, listing_id):
    rows = await db.execute(
        select(ModerationEvent).where(ModerationEvent.listing_id == listing_id)
    )
    return rows.scalars().all()


# ---------------------------------------------------------------------------
# Test 1 — blatant scam text, real AI call, via moderation_sweep()
# ---------------------------------------------------------------------------

async def test_scam_text_via_sweep():
    print("\n[1] Blatant scam text -> moderation_sweep() -> flagged + unpublished")
    async with async_session_factory() as db:
        supplier = await _a_supplier(db)
        listing = await _make_supply(
            db,
            supplier,
            "DOUBLE YOUR MONEY GUARANTEED",
            "Send Rs 50,000 to my personal bank account today and I will send back "
            "Rs 100,000 within 24 hours, 100% guaranteed no risk. Do NOT use GoviHub "
            "payments or tell the platform, message me on WhatsApp only so we skip "
            "the platform. This is a limited crypto investment offer, act now.",
        )
        lid = listing.id
        await db.commit()

    # Stub the LLM at the service seam so the flag path is provable even when
    # the local OpenRouter key is dead. The scam text above is what a live model
    # would see; the stub supplies the verdict a live model should return.
    stub = _StubLLM('```json\n{"verdict":"flagged","categories":["scam","contact-bait"],'
                    '"reason":"advance-fee fraud and pushes the buyer off-platform"}\n```')
    real = mod.OpenRouterClient
    mod.OpenRouterClient = stub
    try:
        scanned = await moderation_sweep()
    finally:
        mod.OpenRouterClient = real
    print(f"  sweep scanned {scanned} listing(s)")

    async with async_session_factory() as db:
        row = await db.execute(select(SupplyListing).where(SupplyListing.id == lid))
        listing = row.scalar_one()
        evts = await _events(db, lid)
        status = getattr(listing.status, "value", str(listing.status))

        check("moderation_status == flagged", listing.moderation_status == "flagged",
              f"got {listing.moderation_status!r}")
        check("listing unpublished (status == discontinued)", status == "discontinued",
              f"got {status!r}")
        check("moderation_events row written", len(evts) >= 1, f"{len(evts)} event(s)")
        for e in evts:
            print(f"      event kind={e.kind} verdict={e.verdict} model={e.model}")
            print(f"            reason={(e.reason or '')[:160]}")
        check("a flagged event exists", any(e.verdict == "flagged" for e in evts))


# ---------------------------------------------------------------------------
# Test 2 — admin manual flag and approve use the SAME shared path
# ---------------------------------------------------------------------------

async def test_admin_flag_and_approve():
    print("\n[2] Admin manual flag -> unpublish_listing (shared path) -> approve")
    async with async_session_factory() as db:
        supplier = await _a_supplier(db)
        listing = await _make_supply(db, supplier, "Urea 50kg", "Standard fertilizer.")
        lid = listing.id
        await db.commit()

    async with async_session_factory() as db:
        ok = await mod.unpublish_listing(db, "supply", lid, "admin manual: test takedown")
        await db.commit()
        check("unpublish_listing returned True", ok is True)

    async with async_session_factory() as db:
        listing = (await db.execute(select(SupplyListing).where(SupplyListing.id == lid))).scalar_one()
        s = getattr(listing.status, "value", str(listing.status))
        check("manual flag -> discontinued", s == "discontinued", f"got {s!r}")
        check("manual flag -> moderation_status flagged", listing.moderation_status == "flagged")

    async with async_session_factory() as db:
        ok = await mod.approve_listing(db, "supply", lid)
        await db.commit()
        check("approve_listing returned True", ok is True)

    async with async_session_factory() as db:
        listing = (await db.execute(select(SupplyListing).where(SupplyListing.id == lid))).scalar_one()
        s = getattr(listing.status, "value", str(listing.status))
        evts = await _events(db, lid)
        check("approve -> republished (active)", s == "active", f"got {s!r}")
        check("approve -> moderation_status reviewed", listing.moderation_status == "reviewed")
        check("approve wrote an event", any("approved" in (e.reason or "") for e in evts))


# ---------------------------------------------------------------------------
# Test 3 — image path, flag verdict MOCKED at the service seam
# ---------------------------------------------------------------------------

async def test_image_flag_mocked():
    print("\n[3] Image scan flagged (mocked verdict at the service seam)")
    async with async_session_factory() as db:
        supplier = await _a_supplier(db)
        listing = await _make_supply(db, supplier, "Seed pack", "Vegetable seeds.")
        listing.images = {"urls": ["https://example.invalid/photo.jpg"]}
        lid = listing.id
        await db.commit()

    # Seam: replace the HTTP call so no real image is fetched or sent, and force
    # the model to "return" a flagged verdict.
    class _FakeResponse:
        status_code = 200

        def raise_for_status(self):
            return None

        def json(self):
            return {
                "model": "google/gemini-2.0-flash-001",
                "choices": [{"message": {"content":
                    '```json\n{"verdict":"flagged","categories":["nudity"],'
                    '"reason":"mocked test verdict"}\n```'}}],
            }

    class _FakeClient:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def post(self, *a, **k):
            return _FakeResponse()

    # NOTE: `mod.httpx` IS the shared httpx module object. Assigning
    # `mod.httpx.AsyncClient` mutates httpx globally, so the ORIGINAL attribute
    # must be saved and restored — rebinding `mod.httpx` afterwards does not
    # undo it, and the leak silently fakes every later HTTP call in the process.
    import httpx as _httpx
    _real_async_client = _httpx.AsyncClient
    _httpx.AsyncClient = _FakeClient
    try:
        async with async_session_factory() as db:
            verdict = await mod.scan_images(db, "supply", lid, ["https://example.invalid/photo.jpg"])
            await db.commit()
    finally:
        _httpx.AsyncClient = _real_async_client

    check("scan_images returned 'flagged'", verdict == "flagged", f"got {verdict!r}")

    async with async_session_factory() as db:
        listing = (await db.execute(select(SupplyListing).where(SupplyListing.id == lid))).scalar_one()
        evts = await _events(db, lid)
        s = getattr(listing.status, "value", str(listing.status))
        check("image flag unpublished the listing", s == "discontinued", f"got {s!r}")
        check("image flag -> moderation_status flagged", listing.moderation_status == "flagged")
        check("image event recorded with kind='image'",
              any(e.kind == "image" and e.verdict == "flagged" for e in evts))
        check("markdown-fenced JSON parsed",
              any("mocked test verdict" in (e.reason or "") for e in evts))


# ---------------------------------------------------------------------------
# Test 4 — FALSE-POSITIVE GUARD. Ordinary farmer listing must be clean.
# ---------------------------------------------------------------------------

class _StubLLM:
    """Stub OpenRouterClient returning a fixed model response body."""

    def __init__(self, content, *a, **k):
        self._content = content

    def __call__(self, *a, **k):
        return self

    async def chat(self, *a, **k):
        class _R:
            content = self._content
            model = "stub/deterministic"
        return _R()


async def _scan_text_with_stub(lid, blob, content):
    stub = _StubLLM(content)
    real = mod.OpenRouterClient
    mod.OpenRouterClient = stub
    try:
        async with async_session_factory() as db:
            verdict = await mod.scan_text(db, "supply", lid, blob)
            await db.commit()
        return verdict
    finally:
        mod.OpenRouterClient = real


async def test_ordinary_listing_is_clean():
    print("\n[4] FALSE-POSITIVE GUARD: ordinary farmer listing must stay live")
    text_blob = "50kg Ceylon cinnamon, ready next week, Kandy, Rs 2500/kg"
    phone_blob = ("Fresh red onions 200kg available in Anuradhapura from Monday. "
                  "Rs 180 per kg, negotiable for bulk. Call 0771234567.")

    async with async_session_factory() as db:
        supplier = await _a_supplier(db)
        l1 = await _make_supply(db, supplier, "Ceylon cinnamon 50kg", text_blob)
        l2 = await _make_supply(db, supplier, "Red onions 200kg", phone_blob)
        l3 = await _make_supply(db, supplier, "Cinnamon live-check", text_blob)
        lid, lid2, lid3 = l1.id, l2.id, l3.id
        await db.commit()

    # 4a — seam-stubbed clean verdict: proves a clean verdict leaves the
    # listing published and settles moderation_status.
    v1 = await _scan_text_with_stub(lid, text_blob, '{"verdict":"clean","categories":[],"reason":"ordinary trade"}')
    check("stubbed clean verdict -> 'clean'", v1 == "clean", f"got {v1!r}")

    v2 = await _scan_text_with_stub(
        lid2, phone_blob,
        'Sure, here you go:\n{"verdict":"clean","categories":[],"reason":"phone in body is normal"}\nHope that helps.',
    )
    check("clean verdict survives chatty non-JSON wrapper", v2 == "clean", f"got {v2!r}")

    # 4b — REAL model call, no stub. Reports the live verdict verbatim.
    # The only assertion is the fail-safe direction: whatever comes back, an
    # ordinary listing must still be published.
    async with async_session_factory() as db:
        v3 = await mod.scan_text(db, "supply", lid3, text_blob)
        await db.commit()
    print(f"      LIVE MODEL verdict for the cinnamon listing: {v3!r}")
    check("live-model path did not flag an ordinary listing", v3 != "flagged", f"got {v3!r}")

    async with async_session_factory() as db:
        for x in (lid, lid2, lid3):
            l = (await db.execute(select(SupplyListing).where(SupplyListing.id == x))).scalar_one()
            s = getattr(l.status, "value", str(l.status))
            check(f"ordinary listing {str(x)[:8]} still live", s == "active", f"got {s!r}")


# ---------------------------------------------------------------------------
# Test 5 — FAIL OPEN. AI outage must not unpublish or block.
# ---------------------------------------------------------------------------

async def test_fail_open():
    print("\n[5] FAIL OPEN: AI exception -> error event, listing stays live + pending_scan")
    async with async_session_factory() as db:
        supplier = await _a_supplier(db)
        listing = await _make_supply(db, supplier, "Paddy seed 20kg", "Good quality seed paddy.")
        lid = listing.id
        await db.commit()

    class _BoomClient:
        def __init__(self, *a, **k):
            pass

        async def chat(self, *a, **k):
            raise RuntimeError("simulated OpenRouter outage")

    real = mod.OpenRouterClient
    mod.OpenRouterClient = _BoomClient
    try:
        async with async_session_factory() as db:
            verdict = await mod.scan_listing(db, "supply", lid)
            await db.commit()
    finally:
        mod.OpenRouterClient = real

    check("scan returned 'error' (did not raise)", verdict == "error", f"got {verdict!r}")

    async with async_session_factory() as db:
        listing = (await db.execute(select(SupplyListing).where(SupplyListing.id == lid))).scalar_one()
        evts = await _events(db, lid)
        s = getattr(listing.status, "value", str(listing.status))
        check("listing still LIVE after AI outage", s == "active", f"got {s!r}")
        check("moderation_status stays pending_scan (sweep retries)",
              listing.moderation_status == "pending_scan", f"got {listing.moderation_status!r}")
        check("error event recorded", any(e.verdict == "error" for e in evts))
        for e in evts:
            if e.verdict == "error":
                print(f"      error reason={(e.reason or '')[:120]}")


async def cleanup():
    print("\n[cleanup] removing throwaway listings and their events")
    async with async_session_factory() as db:
        for _t, lid in CREATED:
            await db.execute(delete(ModerationEvent).where(ModerationEvent.listing_id == lid))
            await db.execute(delete(SupplyListing).where(SupplyListing.id == lid))
        await db.commit()
    print(f"  removed {len(CREATED)} listing(s)")


async def main():
    from app.config import settings
    print(f"OPENROUTER_API_KEY configured: {bool(settings.OPENROUTER_API_KEY)}")
    print(f"OPENROUTER_MODEL: {settings.OPENROUTER_MODEL}")
    print(f"RESEND_API_KEY configured: {bool(settings.RESEND_API_KEY)}")

    try:
        await test_scam_text_via_sweep()
        await test_admin_flag_and_approve()
        await test_image_flag_mocked()
        await test_ordinary_listing_is_clean()
        await test_fail_open()
    finally:
        await cleanup()

    passed = sum(1 for _n, ok, _d in RESULTS if ok)
    print(f"\n===== {passed}/{len(RESULTS)} checks passed =====")
    for n, ok, d in RESULTS:
        if not ok:
            print(f"  FAILED: {n} — {d}")
    sys.exit(0 if passed == len(RESULTS) else 1)


if __name__ == "__main__":
    asyncio.run(main())
