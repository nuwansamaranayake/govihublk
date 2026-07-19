# TOS_AUDIT.md — STEP 0 findings

**Date:** 2026-07-19
**Branch:** `spices`
**Scope:** Pre-implementation audit for trilingual Terms of Use + match liability disclaimer.
**Status:** Audit complete. 6 deviations found; **all 6 resolved** (3 by manager decision, 2026-07-19).

Method: live probes against `spices.govihublk.com` prod (via `ssh govihub-mumbai`, python urllib —
`curl` is blocked locally), direct queries against the prod `govihub_spices` DB, and a read-only
sweep of the repo. No files modified, no prod state changed.

---

## 1. Registration endpoint — VERIFIED CONTRACT

Live endpoint is `POST /api/v1/auth/beta/register` (the beta flow, **not** an OAuth flow).

**Required fields** (from empty-payload 422):
`username`, `password`, `name`, `role`, `district`, `phone`

**Extra fields are silently tolerated.** Sending `tos_accepted: true` today produces no
"extra fields not permitted" error → adding the field is **additive-safe**, no client breakage.

**Structured error format confirmed** (this is the code-tagged pattern from commit `3e38975`):

```json
{"detail":[{"loc":["body","username"],"field":"username","code":"TOO_SHORT",
            "message":"Use at least 3 characters","offending":null,"type":"value_error"}]}
```

`detail` is a **list**. Frontend `localizeAuthError` reads `detail[0].code`; the field-level handler
reads `detail[0] = {field, code, message}` (`beta-login/page.tsx:107-134, 250`).
→ `TOS_NOT_ACCEPTED` must be emitted in **this exact shape**, not as a bare string.

**Two error envelopes coexist in the API** — note for the new endpoint:
- registration/auth → `{"detail":[ {...} ]}`
- users router → `{"error":{"code":"UNAUTHORIZED","message":"...","details":null}}`
`POST /users/me/accept-tos` should follow the **users-router** envelope.

## 2. Database — VERIFIED

| Check | Result |
|---|---|
| Alembic head (prod) | **`013` (head)** — **NOT 011 as spec claims** |
| `tos_accepted_at` / `tos_version` columns | **Absent** (confirmed) |
| Public tables | 28 |
| Migrations dir | `govihub-api/migrations/versions/` — **not** `alembic/versions/` |

Existing migrations: `...011_enforce_phone_required_for_non_admins`, `012_admin_panel_ops`,
`013_role_change_audit`. **`012` is taken.**

**Live user population** (this is who the re-acceptance modal hits):

| role | count |
|---|---|
| farmer | 59 |
| buyer | 27 |
| supplier | 21 |
| admin | 6 |
| **non-admin total** | **107** |

## 3. Match UI — SPEC ASSUMPTION IS WRONG

- Farmer cards: `govihub-web/src/app/[locale]/farmer/matches/page.tsx`
- Buyer cards: `govihub-web/src/app/[locale]/buyer/matches/page.tsx`
- These are **duplicated inline markup**, not a shared component. A card change means editing both.
- **There is no match detail page or route.** "Detail" is a modal:
  `src/components/ui/ListingDetailsModal.tsx`, opened by a `🔍 viewDetails` button.
- **Action buttons live on the CARD, not in the modal** (`farmer:203-213`), driven by a
  status→actions table (`farmer:72-83`). Statuses: `proposed | accepted | completed | dismissed`.

## 4. Registration form + locales

- Live form: `src/app/[locale]/auth/beta-login/page.tsx` — **one component, login/register tabs,
  `regRole` is a form field**. Not three separate role forms. Submits via **raw `fetch`**, not the
  typed `api` wrapper.
- Secondary path: `src/app/[locale]/auth/register/page.tsx` → `api.post("/users/complete-registration")`
  (OAuth post-login wizard). **This is a second registration path.**
- Locales: `src/messages/{en,si,ta}.json`. Library **next-intl**, config `src/i18n.ts`.
- **Convention: JSON nested one level** — namespace object → flat camelCase/snake_case leaf keys.
  No dotted keys inside the file. Namespaces: `brand, common, nav, auth, roles, home, matches, …`
- `en.json` 657 lines · `si.json` 657 · **`ta.json` 283, mostly `[TA] English placeholder` values.**
- Routing: Next.js App Router, `src/app/[locale]/...`, middleware `locales: ["si","en","ta"]`,
  **`defaultLocale: "si"`**, `localePrefix: "always"` → any terms route **must** be `/[locale]/terms`.

## 5. Terms route — DOES NOT EXIST, AND IS ALREADY LINKED

- No `/terms`, `/privacy`, or `/legal` route anywhere. Probed prod: `/terms`, `/en/terms`,
  `/si/terms`, `/privacy` → **all 404**.
- **Live broken links already shipped:** `auth/login/page.tsx:94,98` link to `/terms` and `/privacy`
  — both 404, and both **missing the locale prefix**.
- Dead footer links: `src/app/[locale]/page.tsx:264-265` → `href="#"`.
- **No global Footer component.** The only footer is inline in the landing page (~line 245-272).
- Existing string `auth.termsAgreement`: *"By continuing, you agree to our Terms of Service and
  Privacy Policy"* — **already asserts terms that do not exist.**

## 6. Fonts — no gap

`src/app/globals.css:1-2` imports `Noto Sans Sinhala` **and `Noto Sans Tamil`** from Google Fonts.
`:lang(ta)` → Noto Sans Tamil (line 33-42). **Tamil glyphs are already covered; no font work needed.**
Caveat: runtime CDN dependency, no self-hosted fallback.

## 7. Admin exemption — pattern to copy

Backend enum `app/users/models.py:15-19` → `UserRole.admin` = `"admin"`.
Existing exemption gate, `app/dependencies.py:68-82`:

```python
async def require_complete_profile(user=Depends(get_current_active_user)):
    if user.role is None or user.role == UserRole.admin:
        return user
    if not user.phone or not user.phone.strip():
        raise ProfileIncompleteError(required_field="phone")
    return user
```

6 admin users are exempt. Frontend has **no** admin exemption today (phone validation is applied
unconditionally client-side) — the exemption is backend-only.

## 8. API contract map (spec STEP 0.7)

| Frontend call | Backend endpoint | Status |
|---|---|---|
| Register submit | `POST /api/v1/auth/beta/register` | exists; add `tos_accepted` |
| OAuth register | `POST /api/v1/users/complete-registration` | exists; **gap — see D2** |
| Re-acceptance modal | `POST /api/v1/users/me/accept-tos` | **404 today — to build** |
| Modal trigger | `GET /api/v1/users/me` | exists (401 unauth); add 2 fields |
| Terms page | `GET /[locale]/terms` | **404 today — to build** |

---

# DEVIATIONS FROM SPEC

### D1 — Migration is `014`, not `012`. *(resolved, no decision needed)*
Spec says "confirm alembic head is 011" and "add migration 012". Prod head is **013**; `012` and
`013` are both taken. Proceeding as **`014_add_tos_acceptance.py`**. Migration dir is
`govihub-api/migrations/versions/`.

### D2 — There is a second registration path the spec does not cover. **RESOLVED — gate both**
Spec 1.3 gates `/auth/beta/register`. But `POST /users/complete-registration` (OAuth wizard) also
creates fully-registered users and would remain an **ungated bypass** — users could reach the
platform with `tos_accepted_at = NULL`. They would be caught later by the re-acceptance modal, so
it is not a hole in coverage, but it *is* a hole in "acceptance at registration".

> **DECISION (Nuwan, 2026-07-19): gate both paths.** `tos_accepted` is required on
> `/users/complete-registration` as well, with the checkbox added to the OAuth wizard form, so
> "accepted at registration" is literally true for every new user. Scope addition accepted:
> one extra form + one extra validation.

### D3 — No match detail page exists. **RESOLVED — card (short) + modal (full)**
Spec 4.3 places `match.disclaimer_full` "on match detail page near the action buttons". Neither
exists as described: detail is `ListingDetailsModal`, and the action buttons are on the *card*.

> **DECISION (Nuwan, 2026-07-19): `disclaimer_short` on the card (both farmer and buyer pages),
> `disclaimer_full` inside `ListingDetailsModal`.** No new route, no relocation of action buttons.
> Accepted trade-off: the full text is not adjacent to accept/dismiss, because those live on the
> card — the short notice carries the point-of-decision duty instead.
> Spec 4.3's "match detail page" is therefore satisfied by the modal.

### D4 — Locale key convention differs from spec. *(resolved, no decision needed)*
Spec lists dotted-flat keys (`register.tos_checkbox`). Repo convention is nested namespace objects.
Spec STEP 0.4 says follow the convention found in audit, so mapping:
`tos.*` → new `tos` namespace (natural fit) · `register.tos_checkbox` → **`auth.tos_checkbox`**
(there is no `register` namespace; registration lives under `auth`).

### D5 — 107 existing users will be hard-blocked on next login. *(flagging, not blocking)*
The modal condition (`tos_accepted_at IS NULL`) is spec-intended and correct, but the blast radius
is every non-admin beta user: 59 farmers, 27 buyers, 21 suppliers. First contact will be a blocking
legal wall in a language pending review (SI) or largely untranslated (TA).

### D6 — `/privacy` stays 404 and `auth.termsAgreement` stays false. **RESOLVED — flag only**
Building `/terms` fixes half of an already-shipped broken link pair. `/privacy` is linked from the
login page and out of spec scope, so it stays a live 404. Separately, `auth.termsAgreement` tells
every user they have agreed to a Privacy Policy that does not exist — a standing AI-washing /
truth-layer problem that this work touches but does not fix.

> **DECISION (Nuwan, 2026-07-19): flag only, fix nothing.** This run's diff stays purely about the
> ToS. Two items carried forward as explicit follow-up work, **not** silently dropped:
> 1. `/privacy` remains a live 404 linked from `auth/login/page.tsx:98`.
> 2. `auth.termsAgreement` continues to assert agreement to a non-existent Privacy Policy.
>
> **Correction to §5 of this audit** (verified against `src/middleware.ts`, not assumed): the
> locale-less `/terms` link on the login page **self-heals** once the route exists. The matcher
> `/((?!api|_next|_vercel|.*\..*).*)` covers `/terms`, and next-intl `localePrefix: "always"`
> redirects it. It 404s today only because the route is missing, not because the href lacks a prefix.
>
> One real wrinkle remains: that redirect targets **`defaultLocale: "si"`**, so a user reading the
> English login page who clicks "Terms of Service" lands on the **Sinhala** terms. Minor, not fixed
> in this run, recorded here so the Playwright T4 result is read correctly.

---

## Known flags (carried into verification doc)

- Legal text is v1 **pending review by a Sri Lankan attorney** — Nuwan owns that follow-up.
- `tos.si.md` + all SI UI strings **pending Aruni review**.
- `tos.ta.md` has **no assigned reviewer**.
- `ta.json` is ~40% the size of `en.json` and mostly `[TA]` placeholders — the Tamil ToS will be the
  most complete Tamil text in the app, sitting inside an otherwise-untranslated shell.
