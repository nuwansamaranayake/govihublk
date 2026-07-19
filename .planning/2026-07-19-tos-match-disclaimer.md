# Terms of Use + Match Liability Disclaimer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a legally structured trilingual Terms of Use, record acceptance at registration, and show a platform-liability disclaimer wherever a match is proposed.

**Architecture:** Two additive nullable columns on `users` carry acceptance state (`tos_accepted_at`, `tos_version`); NULL is the signal that triggers a blocking re-acceptance modal. Server always stamps the timestamp — never the client. ToS body lives as markdown content files rendered by a public `/[locale]/terms` route; short UI strings live in the existing next-intl locale JSON.

**Tech Stack:** FastAPI + SQLAlchemy async + Alembic · Next.js 14 App Router + next-intl · PostgreSQL 16 · Playwright

**Source documents:**
- Spec: `CC_TOS_MATCH_DISCLAIMER.md`
- System audit: `TOS_AUDIT.md` (STEP 0 — 6 deviations, all resolved)
- Truth layer: `docs/agent-legibility/2026-07-19-tos-claims-truth-layer.md`

---

## Binding decisions carried in from audit

These override the spec where they conflict. Do not "correct" them back.

| ID | Decision |
|---|---|
| D1 | Migration is **`014`**, not 012. Dir is `govihub-api/migrations/versions/`. Prod head is `013`. |
| D2 | Gate **both** registration paths — `/auth/beta/register` **and** `/users/complete-registration`. |
| D3 | `disclaimer_short` on match **cards** (farmer + buyer, duplicated markup); `disclaimer_full` in **`ListingDetailsModal`**. No new detail route, no moving action buttons. |
| D4 | Locale keys follow the repo's **nested-namespace** convention, not the spec's dotted-flat. `tos.*` → new `tos` namespace. `register.tos_checkbox` → **`auth.tos_checkbox`** (no `register` namespace exists). |
| D5 | 107 non-admin users (59 farmer / 27 buyer / 21 supplier) will be blocked by the modal on next login. Intended. |
| D6 | `/privacy` 404 and the false `auth.termsAgreement` claim stay **unfixed**. Flag only. |
| R1 | §6 ships **bounded**: "...including artificial intelligence **for crop diagnosis and advisory answers**." Only authorized change to the FINAL English text. |
| R3 | New `/terms` is canonical; `govihub-umbrella/public/terms.html` points at it — **separate deploy, after spices verification**. |
| R4 | §14 ships as written. Mail is accepted (SES catch-all), destination unproven. Open item. |

---

## File Structure

**Backend** (`govihub-api/`)
- Create `migrations/versions/014_add_tos_acceptance.py` — two nullable columns
- Modify `app/config.py` — `TOS_VERSION = "1.0"`
- Modify `app/auth/beta_schemas.py` — generalize `UsernameError` → `FieldError` base; add `TosNotAcceptedError`; add `tos_accepted` to `BetaRegisterRequest`
- Modify `app/main.py:141,145` — handler keys off `FieldError`, reads `inner.field`
- Modify `app/auth/beta_router.py` — stamp acceptance on register
- Modify `app/users/router.py` — `POST /users/me/accept-tos`; gate `complete-registration`; expose fields on `/users/me`
- Modify `app/users/schemas.py` — expose `tos_accepted_at`, `tos_version`
- Test `tests/test_tos.py`

**Content** (`govihub-web/content/tos/`) — `tos.en.md`, `tos.si.md`, `tos.ta.md`

**Frontend** (`govihub-web/src/`)
- Create `app/[locale]/terms/page.tsx` — public route
- Create `components/ui/TosGateModal.tsx` — blocking re-acceptance modal
- Create `components/ui/MatchDisclaimer.tsx` — shared, kills the card-duplication risk
- Modify `messages/{en,si,ta}.json` — `tos` namespace + `auth.tos_*` + `matches.disclaimer_*`
- Modify `app/[locale]/auth/beta-login/page.tsx` — checkbox + `TOS_NOT_ACCEPTED` handling
- Modify `app/[locale]/auth/register/page.tsx` — checkbox (D2)
- Modify `app/[locale]/farmer/matches/page.tsx`, `app/[locale]/buyer/matches/page.tsx` — short disclaimer
- Modify `components/ui/ListingDetailsModal.tsx` — full disclaimer
- Modify `app/[locale]/layout.tsx` — mount `TosGateModal`
- Modify `app/[locale]/page.tsx:264-265` — footer terms link

**Review docs** — `TOS_SI_REVIEW.md`, `TOS_TA_REVIEW.md`, `TOS_DISCLAIMER_VERIFICATION.md`

---

## Task 1: Migration 014

**Files:** Create `govihub-api/migrations/versions/014_add_tos_acceptance.py`

- [ ] **Step 1: Confirm current head is 013**

Run: `docker compose -f docker-compose.dev.yml exec -T govihub-api alembic current`
Expected: `013 (head)`

- [ ] **Step 2: Write the migration**

```python
"""add tos acceptance columns

Revision ID: 014
Revises: 013
Create Date: 2026-07-19
"""
from alembic import op
import sqlalchemy as sa

revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Nullable + no backfill is load-bearing: NULL is the signal that
    # triggers the re-acceptance modal for the 107 pre-existing users.
    op.add_column("users", sa.Column("tos_accepted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("tos_version", sa.String(32), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "tos_version")
    op.drop_column("users", "tos_accepted_at")
```

- [ ] **Step 3: Add the model fields**

In `govihub-api/app/users/models.py`, on the `User` model alongside `deleted_at`:

```python
    tos_accepted_at = Column(DateTime(timezone=True), nullable=True)
    tos_version = Column(String(32), nullable=True)
```

- [ ] **Step 4: Apply and verify columns exist**

Run:
```bash
docker compose -f docker-compose.dev.yml exec -T govihub-api alembic upgrade head
docker compose -f docker-compose.dev.yml exec -T postgres psql -U govihub -d govihub -c \
  "SELECT column_name,data_type,is_nullable FROM information_schema.columns
   WHERE table_name='users' AND column_name LIKE 'tos%';"
```
Expected: two rows — `tos_accepted_at | timestamp with time zone | YES`, `tos_version | character varying | YES`

- [ ] **Step 5: Commit**

```bash
git add govihub-api/migrations/versions/014_add_tos_acceptance.py govihub-api/app/users/models.py
git commit -m "feat(legal): migration 014 — users.tos_accepted_at, users.tos_version"
```

---

## Task 2: TOS_VERSION constant

**Files:** Modify `govihub-api/app/config.py`

- [ ] **Step 1: Add to Settings**

```python
    # Terms of Use — single source of truth. Bumping this re-gates every
    # non-admin user via the re-acceptance modal (tos_version != TOS_VERSION).
    TOS_VERSION: str = "1.0"
```

- [ ] **Step 2: Verify it loads**

Run: `docker compose -f docker-compose.dev.yml exec -T govihub-api python -c "from app.config import settings; print(settings.TOS_VERSION)"`
Expected: `1.0`

- [ ] **Step 3: Commit**

```bash
git add govihub-api/app/config.py && git commit -m "feat(legal): TOS_VERSION setting"
```

---

## Task 3: Generalize the structured field-error mechanism

The existing handler hardcodes `"field": "username"` (`app/main.py:145`) and keys off `UsernameError` (`:141`). `TOS_NOT_ACCEPTED` needs the same envelope on a different field. This generalizes without changing any existing behavior.

**Files:** Modify `govihub-api/app/auth/beta_schemas.py`, `govihub-api/app/main.py:141,145`
**Test:** `govihub-api/tests/test_tos.py`

- [ ] **Step 1: Write the failing test**

```python
import pytest

@pytest.mark.asyncio
async def test_register_without_tos_returns_structured_code(client):
    payload = {
        "username": "tosuser1", "password": "secret123", "name": "Tos User",
        "role": "farmer", "district": "Anuradhapura", "phone": "+94771234567",
    }
    r = await client.post("/api/v1/auth/beta/register", json=payload)
    assert r.status_code == 422
    entry = next(e for e in r.json()["detail"] if e.get("field") == "tos_accepted")
    assert entry["code"] == "TOS_NOT_ACCEPTED"


@pytest.mark.asyncio
async def test_username_errors_keep_their_shape(client):
    """Regression guard: generalizing the handler must not change username errors."""
    r = await client.post("/api/v1/auth/beta/register", json={
        "username": "zz", "password": "secret123", "name": "X",
        "role": "farmer", "district": "Anuradhapura",
        "phone": "+94771234567", "tos_accepted": True,
    })
    entry = next(e for e in r.json()["detail"] if e.get("field") == "username")
    assert entry["code"] == "TOO_SHORT"
```

- [ ] **Step 2: Run it — expect failure**

Run: `docker compose -f docker-compose.dev.yml exec -T -e TEST_DATABASE_URL=postgresql+asyncpg://govihub:govihub_dev_2026@postgres:5432/govihub_test govihub-api pytest tests/test_tos.py -v`
Expected: FAIL — no `tos_accepted` field exists yet, `StopIteration`.

- [ ] **Step 3: Add the base class in `beta_schemas.py`**

Replace the `UsernameError` class with:

```python
class FieldError(ValueError):
    """Typed validator failure with a machine-readable code for frontend mapping.

    Pydantic v2 surfaces the live exception instance at ``err["ctx"]["error"]``
    inside ``ValidationError.errors()``. A custom RequestValidationError handler
    in ``app.main`` detects this type and emits a structured
    ``{field, code, message, offending}`` entry instead of the default
    ``{loc, msg, type}`` shape.
    """

    field = "unknown"

    def __init__(self, code: str, message: str, offending: Optional[str] = None) -> None:
        self.code = code
        self.offending = offending
        super().__init__(message)


class UsernameError(FieldError):
    field = "username"


class TosNotAcceptedError(FieldError):
    field = "tos_accepted"
```

- [ ] **Step 4: Add the field + validator to `BetaRegisterRequest`**

```python
    tos_accepted: bool = Field(default=False)

    @field_validator("tos_accepted")
    @classmethod
    def validate_tos(cls, v: bool) -> bool:
        if v is not True:
            raise TosNotAcceptedError(
                "TOS_NOT_ACCEPTED", "You must accept the Terms of Use to register"
            )
        return v
```

- [ ] **Step 5: Generalize the handler in `app/main.py`**

Line 123: `from app.auth.beta_schemas import UsernameError` → `import FieldError`
Line 141: `if isinstance(inner, UsernameError):` → `if isinstance(inner, FieldError):`
Line 145: `"field": "username",` → `"field": inner.field,`

- [ ] **Step 6: Run tests — expect pass**

Run: same pytest command as Step 2.
Expected: 2 passed. The second test is the regression guard — if it fails, the generalization broke username errors.

- [ ] **Step 7: Commit**

```bash
git add govihub-api/app/auth/beta_schemas.py govihub-api/app/main.py govihub-api/tests/test_tos.py
git commit -m "feat(legal): TOS_NOT_ACCEPTED structured error, generalized field-error envelope"
```

---

## Task 4: Stamp acceptance on registration (both paths — D2)

**Files:** Modify `govihub-api/app/auth/beta_router.py:56`, `govihub-api/app/users/router.py` (complete-registration)
**Test:** `govihub-api/tests/test_tos.py`

- [ ] **Step 1: Write the failing test**

```python
@pytest.mark.asyncio
async def test_register_with_tos_stamps_server_side(client, db_session):
    from sqlalchemy import select
    from app.users.models import User
    r = await client.post("/api/v1/auth/beta/register", json={
        "username": "tosuser2", "password": "secret123", "name": "Tos User",
        "role": "farmer", "district": "Anuradhapura",
        "phone": "+94771234568", "tos_accepted": True,
    })
    assert r.status_code in (200, 201)
    user = (await db_session.execute(
        select(User).where(User.username == "tosuser2"))).scalar_one()
    assert user.tos_accepted_at is not None
    assert user.tos_version == "1.0"
```

- [ ] **Step 2: Run it — expect failure** (`tos_accepted_at is None`)

- [ ] **Step 3: Stamp in `beta_router.py`**

Where the `User(...)` is constructed in `beta_register`, add — never trust a client timestamp:

```python
        tos_accepted_at=datetime.now(timezone.utc),
        tos_version=settings.TOS_VERSION,
```

Ensure `from datetime import datetime, timezone` and `from app.config import settings` are imported.

- [ ] **Step 4: Apply the same gate to `complete-registration` (D2)**

In `app/users/router.py`, on the complete-registration request schema add `tos_accepted: bool = Field(default=False)` with the identical `TosNotAcceptedError` validator, and stamp both columns on the user before commit. This closes the bypass where an OAuth user reaches the platform with `tos_accepted_at = NULL`.

- [ ] **Step 5: Run tests — expect pass**

- [ ] **Step 6: Commit**

```bash
git commit -am "feat(legal): stamp tos acceptance on both registration paths"
```

---

## Task 5: `POST /users/me/accept-tos` + expose fields on `/users/me`

**Files:** Modify `govihub-api/app/users/router.py`, `govihub-api/app/users/schemas.py`
**Test:** `govihub-api/tests/test_tos.py`

Note the envelope difference recorded in `TOS_AUDIT.md §1`: the users router uses
`{"error":{"code":...}}`, not the auth router's `{"detail":[...]}`. Follow the users-router convention.

- [ ] **Step 1: Write the failing test**

```python
@pytest.mark.asyncio
async def test_accept_tos_is_idempotent(client, auth_headers_farmer):
    r1 = await client.post("/api/v1/users/me/accept-tos", headers=auth_headers_farmer)
    assert r1.status_code == 200
    assert r1.json()["tos_version"] == "1.0"
    first = r1.json()["tos_accepted_at"]
    assert first is not None
    r2 = await client.post("/api/v1/users/me/accept-tos", headers=auth_headers_farmer)
    assert r2.status_code == 200
    assert r2.json()["tos_version"] == "1.0"


@pytest.mark.asyncio
async def test_accept_tos_requires_auth(client):
    r = await client.post("/api/v1/users/me/accept-tos")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_me_exposes_tos_fields(client, auth_headers_farmer):
    r = await client.get("/api/v1/users/me", headers=auth_headers_farmer)
    assert r.status_code == 200
    assert "tos_accepted_at" in r.json()
    assert "tos_version" in r.json()
```

- [ ] **Step 2: Run — expect 404 / KeyError**

- [ ] **Step 3: Add the endpoint**

```python
@router.post("/me/accept-tos")
async def accept_tos(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Record acceptance of the current Terms of Use version. Idempotent.

    Server sets the timestamp — a client-supplied one is never trusted.
    """
    current_user.tos_accepted_at = datetime.now(timezone.utc)
    current_user.tos_version = settings.TOS_VERSION
    await db.commit()
    await db.refresh(current_user)
    return {
        "tos_accepted_at": current_user.tos_accepted_at,
        "tos_version": current_user.tos_version,
    }
```

Note `get_current_active_user`, **not** `require_complete_profile` — a user who has not accepted terms must still be able to accept them.

- [ ] **Step 4: Expose on the user response schema**

Add to the `UserResponse` schema in `app/users/schemas.py`:

```python
    tos_accepted_at: Optional[datetime] = None
    tos_version: Optional[str] = None
```

- [ ] **Step 5: Run tests — expect pass. Step 6: Commit**

```bash
git commit -am "feat(legal): POST /users/me/accept-tos + tos fields on /users/me"
```

---

## Task 6: English ToS content file

**Files:** Create `govihub-web/content/tos/tos.en.md`

- [ ] **Step 1: Write the file**

Use the **verbatim** Part 3 text from `CC_TOS_MATCH_DISCLAIMER.md`, with exactly one change — §6 per decision R1:

> Crop diagnosis, advisory answers, weather information, and match suggestions are generated by software, including artificial intelligence for crop diagnosis and advisory answers. They are general guidance only. They are not professional agricultural, financial, or legal advice. Verify important decisions with a qualified officer or advisor.

Every other section is copied without alteration. Do not shorten, reorder, or "improve" any clause — §8 in particular is the Unfair Contract Terms Act carve-out and must survive intact.

- [ ] **Step 2: Verify §8 is present and unmodified**

Run: `grep -A3 "What We Do Not Exclude" govihub-web/content/tos/tos.en.md`
Expected: the death/personal-injury/fraud carve-out, verbatim.

- [ ] **Step 3: Commit**

```bash
git add govihub-web/content/tos/tos.en.md
git commit -m "feat(legal): English Terms of Use v1.0 source text"
```

---

## Task 7: Sinhala + Tamil translation

**Files:** Create `govihub-web/content/tos/tos.si.md`, `tos.ta.md`, `TOS_SI_REVIEW.md`, `TOS_TA_REVIEW.md`

- [ ] **Step 1: Translate the document register**

Use the `anthropic-skills:gemini-translate` skill. Register: clear formal Sinhala/Tamil, plain modern language a farmer with basic literacy understands. No archaic legalese, no literal word-for-word rendering. Statute names use their official published Sinhala/Tamil titles; if uncertain, keep the English statute name with the year.

**§6 must carry the bounded R1 meaning** — AI attaches to crop diagnosis and advisory answers only, not to matching.

- [ ] **Step 2: Verify structure survived translation**

Run: `for f in en si ta; do echo -n "$f: "; grep -c '^[0-9]\+\.' govihub-web/content/tos/tos.$f.md; done`
Expected: identical section counts across all three. A mismatch means a clause was dropped — fix before proceeding.

- [ ] **Step 3: Write the review docs**

`TOS_SI_REVIEW.md` — full `tos.si.md` plus every SI UI string, for Aruni.
`TOS_TA_REVIEW.md` — same for Tamil, flagged **"no reviewer assigned yet"**.
Both note that post-review edits are text-only and need no structural change.

- [ ] **Step 4: Commit**

```bash
git add govihub-web/content/tos/ TOS_SI_REVIEW.md TOS_TA_REVIEW.md
git commit -m "feat(legal): Sinhala + Tamil Terms of Use + review docs"
```

---

## Task 8: Locale keys (D4 — nested convention)

**Files:** Modify `govihub-web/src/messages/{en,si,ta}.json`

- [ ] **Step 1: Add the `tos` namespace and new keys**

English values (SI/TA translated in the same pass, natural spoken register — `ගැළපීම` for match, `ගැනුම්කරු` for buyer, matching existing conventions):

```json
"tos": {
  "title": "Terms of Use",
  "version_line": "Version 1.0. Last updated 19 July 2026.",
  "modal_title": "Updated Terms of Use",
  "modal_body": "Please review and accept our Terms of Use to continue using GoviHub.",
  "modal_view": "View Terms",
  "modal_accept": "Accept"
}
```

Into the existing `auth` namespace (D4 — there is no `register` namespace):

```json
  "tos_checkbox": "I have read and accept the Terms of Use",
  "tos_error": "You must accept the Terms of Use to register",
  "auth_error_tos_not_accepted": "You must accept the Terms of Use to register"
```

Into the existing `matches` namespace:

```json
  "disclaimer_short": "GoviHub only connects you. The sale, payment, and delivery are between you and the other party.",
  "disclaimer_full": "GoviHub connects farmers and buyers. We are not a party to any sale. Price, quality, delivery, and payment are agreed directly between you and the other party, at your own responsibility.",
  "disclaimer_link": "Terms of Use"
```

**Do not touch** the 23 pre-existing Tamil auth keys (out of scope per spec).

- [ ] **Step 2: Verify all three files stay valid JSON with matching key sets**

Run:
```bash
node -e "
const en=require('./govihub-web/src/messages/en.json');
for (const l of ['si','ta']) {
  const m=require('./govihub-web/src/messages/'+l+'.json');
  for (const ns of ['tos','auth','matches'])
    for (const k of Object.keys(en[ns]))
      if (!(k in (m[ns]||{}))) console.log('MISSING', l, ns+'.'+k);
}
console.log('done');"
```
Expected: only pre-existing TA gaps listed; **no missing `tos.*`, `auth.tos_*`, or `matches.disclaimer_*` keys.**

- [ ] **Step 3: Commit**

```bash
git commit -am "feat(legal): trilingual ToS locale keys"
```

---

## Task 9: Public `/[locale]/terms` route

**Files:** Create `govihub-web/src/app/[locale]/terms/page.tsx`; modify `govihub-web/src/app/[locale]/page.tsx:264-265`

- [ ] **Step 1: Build the route**

Server component. Reads `content/tos/tos.{locale}.md` by the active locale, falls back to `en` if the file is missing, renders markdown. Requirements: public (no auth — the registration form links here pre-auth); readable at 360px; respects the app-wide language setting.

`middleware.ts` matcher `/((?!api|_next|_vercel|.*\..*).*)` already covers `/terms`, and `localePrefix: "always"` redirects the bare path — so the pre-existing locale-less link at `auth/login/page.tsx:94` self-heals once this route exists (it lands on **`si`**, the default locale — see `TOS_AUDIT.md` D6 correction).

- [ ] **Step 2: Wire the footer link**

`app/[locale]/page.tsx:265` — replace `href="#"` on `footerTerms` with a locale-aware link to `/${locale}/terms`. Leave `footerPrivacy` alone (D6).

- [ ] **Step 3: Verify all three languages render**

Run: `docker compose -f docker-compose.dev.yml up -d govihub-web` then check `/en/terms`, `/si/terms`, `/ta/terms` return 200 and render script correctly — no tofu boxes. Fonts are already covered (`globals.css:1-2` loads Noto Sans Sinhala **and** Noto Sans Tamil); no font work needed.

- [ ] **Step 4: Commit**

```bash
git add govihub-web/src/app/[locale]/terms/ govihub-web/src/app/[locale]/page.tsx
git commit -m "feat(legal): public /terms route + footer link"
```

---

## Task 10: Registration checkbox (both paths — D2)

**Files:** Modify `govihub-web/src/app/[locale]/auth/beta-login/page.tsx`, `.../auth/register/page.tsx`

- [ ] **Step 1: Add the checkbox to the beta register tab**

Label `auth.tos_checkbox`, with "Terms of Use" linking to `/${locale}/terms` via `target="_blank"` so form state survives. Submit disabled until checked. Send `tos_accepted: true` in the POST body.

- [ ] **Step 2: Map the error code**

Add to `AUTH_ERROR_KEYS` (`beta-login/page.tsx:107-114`):

```ts
  TOS_NOT_ACCEPTED: "auth_error_tos_not_accepted",
```

The field-level handler at `:250` already routes `detail[0] = {field, code, message}` to an inline message — `tos_accepted` will flow through it once the code is mapped.

- [ ] **Step 3: Same for the OAuth wizard** (`auth/register/page.tsx`, D2) — checkbox + `tos_accepted: true` on the `api.post("/users/complete-registration")` call.

- [ ] **Step 4: Verify** — submit unchecked (blocked), then checked (succeeds). Both paths, EN and SI.

- [ ] **Step 5: Commit**

```bash
git commit -am "feat(legal): ToS checkbox on both registration paths"
```

---

## Task 11: Match disclaimer (D3)

**Files:** Create `govihub-web/src/components/ui/MatchDisclaimer.tsx`; modify `farmer/matches/page.tsx`, `buyer/matches/page.tsx`, `components/ui/ListingDetailsModal.tsx`

A shared component rather than inline copy in both pages — the farmer and buyer cards are already duplicated markup (`TOS_AUDIT.md §3`) and duplicating legal text across two files is how they drift.

- [ ] **Step 1: Build the component**

```tsx
"use client";
import { useTranslations, useLocale } from "next-intl";

export function MatchDisclaimer({ variant }: { variant: "short" | "full" }) {
  const t = useTranslations("matches");
  const locale = useLocale();
  return (
    <p className="text-xs text-gray-500 leading-relaxed">
      {t(variant === "short" ? "disclaimer_short" : "disclaimer_full")}{" "}
      <a href={`/${locale}/terms`} target="_blank" rel="noopener noreferrer"
         className="underline hover:text-gray-700">
        {t("disclaimer_link")}
      </a>
    </p>
  );
}
```

Quiet but always visible — small, neutral gray, not an alarming banner. **No feature flag: legal text must not be toggleable off.**

- [ ] **Step 2: Mount `variant="short"` on both match cards** (farmer + buyer).
- [ ] **Step 3: Mount `variant="full"` in `ListingDetailsModal`** (D3 — this is the "detail" surface).
- [ ] **Step 4: Verify** in EN and SI, farmer and buyer, that both variants render and the link opens `/terms`.
- [ ] **Step 5: Commit**

```bash
git add govihub-web/src/components/ui/MatchDisclaimer.tsx
git commit -am "feat(legal): match liability disclaimer on cards + detail modal"
```

---

## Task 12: Blocking re-acceptance modal

**Files:** Create `govihub-web/src/components/ui/TosGateModal.tsx`; modify `app/[locale]/layout.tsx`

- [ ] **Step 1: Build the modal**

Condition (spec 1.5): show when **non-admin** AND (`tos_accepted_at` is null OR `tos_version !== "1.0"`).

```ts
const needsTos =
  user && user.role !== "admin" &&
  (!user.tos_accepted_at || user.tos_version !== TOS_VERSION);
```

Content: `tos.modal_title`, `tos.modal_body`, `tos.modal_view` (opens `/terms` in a new tab), `tos.modal_accept` (POSTs `/users/me/accept-tos`, then closes). Blocking — the app behind it is not interactive. **Logout must remain available**, otherwise a user who declines is trapped.

`TOS_VERSION` is hardcoded `"1.0"` in the frontend — the backend is the source of truth and there is no meta endpoint exposing it. Log this in `TECH_DEBT.md`.

- [ ] **Step 2: Mount in the locale layout**, inside the auth provider so it sees the current user.

- [ ] **Step 3: Verify against a real pre-migration user**

This is the D5 path — 107 users hit this. Log in as a user with `tos_accepted_at IS NULL`: modal appears and blocks; View Terms opens; Accept closes it; **reload — it must not reappear**. Then confirm an admin never sees it.

- [ ] **Step 4: Commit**

```bash
git add govihub-web/src/components/ui/TosGateModal.tsx govihub-web/src/app/[locale]/layout.tsx
git commit -m "feat(legal): blocking ToS re-acceptance modal (admin exempt)"
```

---

## Task 13: Deploy to spices prod

**Files:** none — deploy only. Follow `docker-compose.spices.yml` on `govihub-mumbai`. Container names per `TOS_AUDIT.md`; task docs elsewhere use wrong names.

- [ ] **Step 1: Snapshot the DB first**

```bash
ssh govihub-mumbai 'docker exec govihub-spices-postgres-spices-1 pg_dump -U govihub govihub_spices \
  > /root/backups/spices-pre-tos-$(date +%Y%m%d-%H%M%S).sql'
```

- [ ] **Step 2: Pull and build — no cache** (the web image bakes `NEXT_PUBLIC_API_URL` at build time, so a locale/route change needs a real rebuild, not a restart)

```bash
ssh govihub-mumbai 'cd /opt/govihub-spices && git pull origin spices && \
  docker compose -f docker-compose.spices.yml build --no-cache govihub-api-spices govihub-web-spices'
```

- [ ] **Step 3: Migrate and verify the columns landed**

```bash
ssh govihub-mumbai 'docker exec govihub-spices-govihub-api-spices-1 alembic upgrade head && \
  docker exec govihub-spices-postgres-spices-1 psql -U govihub -d govihub_spices -c \
  "SELECT column_name,data_type,is_nullable FROM information_schema.columns
   WHERE table_name='"'"'users'"'"' AND column_name LIKE '"'"'tos%'"'"';"'
```
Expected: head `014`, two rows. **Record the raw output in the verification doc.**

- [ ] **Step 4: Confirm untouched infrastructure** — single Gunicorn worker, Traefik `flushInterval` unchanged, MCP container settings not modified.

- [ ] **Step 5: Smoke tests with real tokens** — record every request and response:

| Check | Expected |
|---|---|
| Register without `tos_accepted` | 422, `code: TOS_NOT_ACCEPTED`, `field: tos_accepted` |
| Register with `tos_accepted: true` | 201, then DB shows `tos_accepted_at` set and `tos_version='1.0'` |
| `POST /users/me/accept-tos` as pre-migration user | 200, DB updated |
| `GET https://spices.govihublk.com/terms` | 200 **without auth** |
| `GET /si/terms`, `/ta/terms` | 200, correct script |

Per project rules: `curl` is blocked locally — probe via `ssh govihub-mumbai python3 - <<'PY' ... urllib ... PY`.

---

## Task 14: Playwright verification (prod, EN + SI, real UI navigation)

**Files:** Create tests under `e2e-v3/`

A feature unreachable through normal navigation is a **FAIL** — every test navigates the real UI, no direct URL jumps except where the test is specifically about a public URL.

- [ ] T1 — Registration via UI: valid fields, checkbox unchecked → submit blocked or `auth.tos_error` shows. Check box → registration succeeds.
- [ ] T2 — Pre-existing NULL-acceptance user: modal appears and blocks; View Terms opens; Accept closes; **reload → does not reappear**.
- [ ] T3 — Farmer match card shows `disclaimer_short`; open detail modal → `disclaimer_full` visible. Repeat in SI: Sinhala renders, **no tofu**.
- [ ] T4 — `/terms` reachable from the footer link; full document renders in EN, SI, TA. **Screenshot each.**
- [ ] T5 — Admin login: **no modal**.
- [ ] T6 — New registration in SI locale: checkbox label and error render in Sinhala.

All six must pass.

---

## Task 15: Verification doc + commits

- [ ] **Step 1: Compile `TOS_DISCLAIMER_VERIFICATION.md`** — STEP 0 findings, migration column output, every smoke-test request/response, T1–T6 with screenshots, commit hashes, and references to both translation review docs.

- [ ] **Step 2: State the known flags loudly** (not buried):
  - Legal text is v1 **pending Sri Lankan attorney review** — Nuwan owns this. §6 was narrowed (R1) and should be called out at the top of the attorney packet.
  - `tos.si.md` + all SI UI strings **pending Aruni review**.
  - `tos.ta.md` has **no assigned reviewer**; `ta.json` is ~40% translated, so the ToS will be the most complete Tamil text in an otherwise-English shell.
  - `/privacy` remains a live 404; `auth.termsAgreement` still asserts a non-existent Privacy Policy (D6).
  - §14 `support@` accepts mail but the SES receipt-rule destination is **unproven** (R4).

- [ ] **Step 3: Squash into the two spec-mandated commits** on branch `spices`, push, record hashes.

- [ ] **Step 4: R3 follow-up — separate deploy.** After spices verification passes, point `govihub-umbrella/public/terms.html` at the canonical `/terms`. Different stack (`docker-compose.umbrella.yml`), so it does **not** ride along with this deploy.

---

## Rollback

- **Frontend/modal breakage:** redeploy the previous web image.
- **Backend breakage:** revert the registration validation commit, redeploy api.
- **Columns are additive and safe to leave in place. Do NOT drop columns in a rollback** — dropping them destroys acceptance records for every user who already accepted.

## Out of scope — do not touch

Existing Tamil auth locale debt (23 keys) · username validation frontend work · MCP container, Gunicorn worker count, Traefik config · admin seeding, phone validation, moderation design docs · `knowledge_chunks`, `advertisements`, any user data beyond the two new columns.
