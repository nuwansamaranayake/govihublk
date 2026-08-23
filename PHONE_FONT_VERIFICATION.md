# PHONE_FONT_VERIFICATION.md

**Tasks:** A — normalize admin phone (and close G2.6) · B — load Noto Sans Sinhala on the umbrella
**Date:** 2026-08-23 · **Branch:** `spices` · **Commit:** `31d5bb7` (Task B; Task A is data-only)
**Spec:** `CC_PHONE_NORMALIZE_AND_UMBRELLA_FONT.md` · **State:** `/opt/govihub-spices/.cc_state/phone_font_micro.json`

**Task B: complete, all gates green. Task A: outcome achieved, but the specified method was
impossible — G2.6 remains OPEN and is not closable today. Details below.**

---

## Task A — admin phone normalization

### Before / after

| | value |
|---|---|
| before | `0771234567` |
| after | `+94771234567` |
| user | `nuwan`, role `admin`, id `06ef3053-a55d-464b-8475-d88e42f69590` |

Before-state matched the spec's expectation exactly, so the task proceeded.

### The specified method does not exist — G2.6 cannot be closed

The spec required driving the live admin panel's user-edit form, which would also have closed gate
G2.6 from the previous loop. Playwright against the real UI found **two independent blockers**:

1. **The record is unreachable.** `/admin/users` fetches `?size=100` once, with **no pagination**,
   and filters browser-side. Prod has 203 users ordered `created_at DESC`; `nuwan` ranks **201**.
   Live run: 100 users loaded, searching "nuwan" returned **0 results**
   (`e2e-v3/screenshots/phone-font/003_A03_search_nuwan_in_user_list.png`).
2. **There is no phone field.** Opening a *reachable* user's detail modal to inventory the form:
   editable controls = **none**; buttons = `Close | Suspend | Deactivate | Reset Password`. Phone is
   read-only text. Admin Settings has no profile phone field either.

**G2.6 stays OPEN.** It is not a test gap — the form it describes does not exist. It cannot be
closed until the admin panel gains a user-edit phone field.

### Deviation: normalization completed via the admin API

The *outcome* was explicitly authorized ("Normalize admin nuwan's phone from `0771234567` to
`+94771234567`"); only the *method* was blocked by a missing feature. The change was applied through
`PUT /api/v1/admin/users/{id}` — the same endpoint the panel would call if the field existed, and
the one verified in G2.3 last loop. Reversible, with the restore command on hand.

Deliberately **not** done as a raw SQL UPDATE: routing it through the API means the new E.164
validator actually adjudicated the value, which is the behaviour under test.

```
API negative control  PUT phone=0771234567    -> 422   (validator rejects the old format)
API normalize         PUT phone=+94771234567  -> 200
DB verify             nuwan | admin | +94771234567
admin re-login        200, /users/me -> role admin, phone +94771234567
```

### Gates

| Gate | Status | Evidence |
|---|---|---|
| GA.1 form rejects `0771234567` | **BLOCKED** | No phone input exists in the admin UI; record also unreachable |
| GA.2 form accepts `+94771234567` | **BLOCKED** | Same — the API was not silently substituted inside a UI gate |
| GA.3 DB shows `+94771234567` | **PASS** (via API path) | psql: `nuwan \| admin \| +94771234567` |
| GA.4 admin re-login succeeds | **PASS** | UI logout → re-login → `/en/admin/dashboard` (`007_A08_*.png`); re-verified by API **after** the change: 200 |
| G2.6 (carried from last loop) | **STILL OPEN** | Root cause now documented: the form does not exist |

**Restore path: NOT used.** No mid-task failure occurred. During the UI investigation the phone was
confirmed unchanged at `0771234567` before and after, so the only write was the intentional one.

### Two admin-panel defects found in passing (not fixed — out of scope)

1. `/admin/users` loads a hard `size=100` with no pagination and searches only the loaded page, so
   any user outside the 100 most recent is **invisible and unmanageable**. With 203 users, roughly
   half the base is unreachable — including the founder's own account.
2. The user detail modal exposes no editable fields — user data cannot be corrected through the
   panel at all, only suspended / deactivated / password-reset.

## Task B — Noto Sans Sinhala on the umbrella

### Audit

| Finding | Detail |
|---|---|
| How spices loads it | **CSS `@import`** in `govihub-web/src/app/globals.css:2`, weights `400;500;600;700` — not `next/font`, not `<link>` |
| Umbrella pages | **7** — index, si, about, about-si, contact, contact-si, privacy (more than the spec's two; sub-pages carry Sinhala too) |
| Body stack | `styles.css:22` already lists `"Noto Sans Sinhala"` first → **no CSS change needed**, head links only |
| Font links before | **0 of 7** pages had any |

### Route taken, and two deliberate deviations

**Delivery: plain-HTML `<link>` + preconnect on all 7 pages**, not the spices `@import`. The spec
anticipated this ("use the plain-HTML equivalent, and say which route was taken"). `<link>` is also
faster — an `@import` inside styles.css serializes fetch-CSS-then-fetch-font — and GB.1 requires the
link present per page.

**Weights `400;500;600;700;800`, not the spec's suggested `400;700`.** The spec's own first rule is
"weights matching what the CSS actually uses". The umbrella CSS uses **500, 600, 700, 800** (plus
implicit 400), and critically `.vm-head` — the Sinhala "දැක්ම — Vision" / "මෙහෙවර — Mission"
subheads — is **`font-weight: 800`**. Shipping `400;700` would have left precisely the Sinhala this
task exists to fix rendering as synthetic bold. This also intentionally diverges from spices, whose
Sinhala import stops at 700.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Sinhala:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

Inserted immediately before the existing `styles.css` link in each page, idempotently (the script
skips any file already carrying it). Verified exactly one occurrence per file, URL intact.

### Gates

```
GB.1  font link on every live page          7 / 7   (preconnect present on all 7)
GB.2  document.fonts.check('16px "Noto Sans Sinhala"')  -> true on / and /si, both viewports
      fonts.gstatic.com successful font requests        -> 2/2 on each page
      CDP CSS.getPlatformFontsForNode:
        .vm-si   Sinhala paragraph   -> Noto Sans Sinhala (152 glyphs desktop / 148 mobile)
        .vm-head @ font-weight 800   -> Noto Sans Sinhala (13 glyphs), check('800 26px ...') = true
                                        i.e. the 800 weight is genuinely loaded, NOT synthesized
      console errors / page errors / failed requests     -> 0 / 0 / 0
GB.3  8 screenshots: / and /si  x  1280x800 and 360x640  x  fullpage + element
      e2e-v3/screenshots/phone-font/00{1..8}_B_*.png
GB.4  all 7 pages 200; all 6 assets (hero, 3 tiles, logo, lang-toggle.js) 200; 0 failures
```

### What this did and did not change

Before, the umbrella listed Noto Sans Sinhala in the body stack but shipped no webfont, so Sinhala
rendered in whatever face the visitor's OS supplied — working on mainstream devices via last-resort
fallback, but with no typographic control and no guarantee. It now loads the real face, including
the 800 weight the headings ask for.

**Honest caveat:** GB.2 ran on Windows 11, which itself ships Sinhala-capable Nirmala UI. The
transferable evidence is the CDP `platform_fonts` family name (`Noto Sans Sinhala`) plus the 2/2
gstatic font fetches — i.e. the webfont was downloaded and used — not merely that glyphs appeared.

**New dependency introduced:** the umbrella now makes external requests to `fonts.googleapis.com`
and `fonts.gstatic.com` on every page load. It previously had zero external dependencies. That is
the trade this task accepted; `display=swap` keeps text visible during load.

## Close-out

- Task B committed and pushed: `31d5bb7`. Umbrella rebuilt `--no-cache` and recreated.
- Task A is data-only — no commit, recorded here.
- **No spices code change and no spices rebuild**, as required.

## Carried forward

- **G2.6 still open** — needs an admin-panel user-edit form with a phone field.
- The two admin-panel defects above (pagination/search; no editable fields).
- Plaintext production admin credential in `e2e-v3/test-all.js:20` — used again for these gates
  (passed via env var, never written to a file or into this document). Still the top security item.
