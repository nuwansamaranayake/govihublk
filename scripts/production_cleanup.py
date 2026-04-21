"""Production cleanup: per-user transactional delete for spices DB.

Whitelist rule: preserve role=admin + govihub.ai@gmail.com triad.
Everything else is hard-deleted.
"""

from __future__ import annotations

import asyncio
import json
import sys
from datetime import datetime, timezone

from sqlalchemy import text

from app.database import async_session_factory


DELETE_ORDER = [
    ("ad_events", "DELETE FROM ad_events WHERE user_id = :uid"),
    (
        "matches (via harvest/demand)",
        """DELETE FROM matches
           WHERE harvest_id IN (SELECT id FROM harvest_listings WHERE farmer_id = :uid)
              OR demand_id  IN (SELECT id FROM demand_postings  WHERE buyer_id  = :uid)""",
    ),
    ("harvest_listings", "DELETE FROM harvest_listings WHERE farmer_id = :uid"),
    ("demand_postings", "DELETE FROM demand_postings WHERE buyer_id = :uid"),
    ("supply_listings", "DELETE FROM supply_listings WHERE supplier_id = :uid"),
    ("crop_diagnoses", "DELETE FROM crop_diagnoses WHERE user_id = :uid"),
    ("advisory_questions", "DELETE FROM advisory_questions WHERE user_id = :uid"),
    ("beta_feedback", "DELETE FROM beta_feedback WHERE user_id = :uid"),
    ("weather_alerts", "DELETE FROM weather_alerts WHERE user_id = :uid"),
    ("farmer_crop_selections", "DELETE FROM farmer_crop_selections WHERE user_id = :uid"),
    ("notification_preferences", "DELETE FROM notification_preferences WHERE user_id = :uid"),
    ("notifications", "DELETE FROM notifications WHERE user_id = :uid"),
    ("refresh_tokens", "DELETE FROM refresh_tokens WHERE user_id = :uid"),
    ("google_accounts", "DELETE FROM google_accounts WHERE user_id = :uid"),
    ("farmer_profiles", "DELETE FROM farmer_profiles WHERE user_id = :uid"),
    ("buyer_profiles", "DELETE FROM buyer_profiles WHERE user_id = :uid"),
    ("supplier_profiles", "DELETE FROM supplier_profiles WHERE user_id = :uid"),
    ("users", "DELETE FROM users WHERE id = :uid"),
]


def log(entry: dict, log_path: str) -> None:
    entry["ts"] = datetime.now(timezone.utc).isoformat()
    line = json.dumps(entry, default=str)
    print(line)
    with open(log_path, "a", encoding="utf-8") as f:
        f.write(line + "\n")


async def main(log_path: str) -> None:
    async with async_session_factory() as session:
        r = await session.execute(
            text(
                """SELECT id, email, role, name FROM users
                   WHERE role != 'admin'
                     AND NOT (email = 'govihub.ai@gmail.com'
                              AND role IN ('farmer','buyer','supplier'))
                   ORDER BY role, created_at"""
            )
        )
        users = r.mappings().all()
        log({"event": "begin", "user_count": len(users)}, log_path)

        assert len(users) == 31, f"Expected 31 users, got {len(users)} — aborting"

        ok = 0
        fail = 0
        for u in users:
            uid = u["id"]
            counts: dict[str, int] = {}
            try:
                for label, sql in DELETE_ORDER:
                    result = await session.execute(text(sql), {"uid": uid})
                    counts[label] = result.rowcount
                await session.commit()
                ok += 1
                log(
                    {
                        "event": "user_deleted",
                        "user_id": str(uid),
                        "email": u["email"],
                        "role": u["role"],
                        "name": u["name"],
                        "counts": counts,
                    },
                    log_path,
                )
            except Exception as exc:
                await session.rollback()
                fail += 1
                log(
                    {
                        "event": "user_failed",
                        "user_id": str(uid),
                        "email": u["email"],
                        "role": u["role"],
                        "error": str(exc),
                        "counts_so_far": counts,
                    },
                    log_path,
                )

        # Seed-data scrub for preserved dev triad so sanity tests start clean.
        # Keep advisory_questions (they have RAG training value and are expected
        # to survive per plan Part 3.4).
        triad = (
            "(email = 'govihub.ai@gmail.com' AND role IN ('farmer','buyer','supplier'))"
        )
        scrub_queries = [
            (
                "matches (triad harvest)",
                f"""DELETE FROM matches WHERE harvest_id IN (
                      SELECT h.id FROM harvest_listings h JOIN users u ON u.id=h.farmer_id
                      WHERE {triad})""",
            ),
            (
                "matches (triad demand)",
                f"""DELETE FROM matches WHERE demand_id IN (
                      SELECT d.id FROM demand_postings d JOIN users u ON u.id=d.buyer_id
                      WHERE {triad})""",
            ),
            (
                "harvest_listings (triad)",
                f"DELETE FROM harvest_listings WHERE farmer_id IN (SELECT id FROM users WHERE {triad})",
            ),
            (
                "demand_postings (triad)",
                f"DELETE FROM demand_postings WHERE buyer_id IN (SELECT id FROM users WHERE {triad})",
            ),
            (
                "supply_listings (triad)",
                f"DELETE FROM supply_listings WHERE supplier_id IN (SELECT id FROM users WHERE {triad})",
            ),
            (
                "weather_alerts (triad)",
                f"DELETE FROM weather_alerts WHERE user_id IN (SELECT id FROM users WHERE {triad})",
            ),
            (
                "farmer_crop_selections (triad)",
                f"DELETE FROM farmer_crop_selections WHERE user_id IN (SELECT id FROM users WHERE {triad})",
            ),
        ]
        scrub_counts: dict[str, int] = {}
        try:
            for label, sql in scrub_queries:
                res = await session.execute(text(sql))
                scrub_counts[label] = res.rowcount
            await session.commit()
            log({"event": "triad_seed_scrub", "counts": scrub_counts}, log_path)
        except Exception as exc:
            await session.rollback()
            log({"event": "triad_seed_scrub_failed", "error": str(exc)}, log_path)

        log({"event": "end", "ok": ok, "fail": fail}, log_path)

        if fail:
            sys.exit(1)


if __name__ == "__main__":
    log_file = sys.argv[1] if len(sys.argv) > 1 else "/tmp/CLEANUP_EXECUTION.log"
    asyncio.run(main(log_file))
