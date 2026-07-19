# UMBRELLA_TERMS_REDIRECT_VERIFICATION.md

**Date:** 2026-07-19 · **Branch:** `spices` · **Commit:** `61b32d4`
**Scope:** umbrella stack only. Spices stack untouched — proven below.
**Companion:** [`UMBRELLA_TERMS_AUDIT.md`](UMBRELLA_TERMS_AUDIT.md) (STEP 0)

**Outcome: R3 CLOSED.** One canonical Terms of Use governs the platform — the in-app document at
`spices.govihublk.com/[locale]/terms`. The umbrella path is a permanent 301 to it.

---

## 1. STEP 0 — findings and deviations

Full detail in the audit doc. Three deviations from the spec, all recorded before any change:

**D1 — the legal conflict the spec targets was already resolved.** The spec describes the umbrella
serving an older ToS dated 2026-04-17 with the AI-generated-matching claim and a 12-month liability
cap. That was true in the morning and was fixed ~1 hour before the spec arrived: `govihublk.com/terms`
was already serving canonical **v1.1**, verified live with zero stale markers.

The conflict had been closed by **convergence** (identical text on both surfaces). This change closes
it by **retirement** instead — a strictly stronger outcome, because convergence left two copies that
had to be updated in lockstep forever, and the failure mode of forgetting one is a silent legal
conflict rather than a visible bug. **Manager decision: proceed with the redirect.**

**D2 — a Sinhala umbrella terms page existed** (`terms-si.html` at `/terms-si`), created earlier the
same day. The spec anticipated this possibility; it is handled (301 → `/si/terms`).

**D3 — canonical is v1.1 (17 sections), not v1.0.** The spec cites "§7 plus §8" for liability; in
v1.1 those are **§10 (Limitation of Liability)** and **§11 (What We Do Not Exclude)**. The AI clause
is **§9**.

### Routing mechanism (recorded verbatim, as instructed)

Not `try_files $uri $uri.html`. The umbrella nginx uses **explicit exact-match blocks per clean URL**
plus a **regex block that serves any `.html` directly**:

```nginx
location ~ \.html$ {
    add_header Cache-Control "public, max-age=300" always;
    try_files $uri =404;
}
```

**Consequence that shaped the implementation:** every page is dual-reachable at `/x` and `/x.html`.
Deleting `terms.html` (Part 2) **without** an exact-match redirect for `/terms.html` would have made
that path return **404 instead of a 301**. nginx precedence is `=` > regex `~` > prefix, so exact
blocks win. Both `.html` paths got their own block, and file deletion and redirect shipped together.

### Pre-check — canonical targets returned 200 BEFORE anything was redirected
`spices.govihublk.com/en/terms` → **200**, 17 sections · `/si/terms` → **200**, 17 sections.
Spec STOP condition not triggered.

## 2. Config diff

`govihub-umbrella/nginx.conf` — the two `try_files` blocks replaced by four 301s:

```nginx
location = /terms         { return 301 https://spices.govihublk.com/en/terms; }
location = /terms.html    { return 301 https://spices.govihublk.com/en/terms; }
location = /terms-si      { return 301 https://spices.govihublk.com/si/terms; }
location = /terms-si.html { return 301 https://spices.govihublk.com/si/terms; }
```

**301, not 302** — permanent retirement. **Locale-prefixed targets, not the bare `/terms`** — the
app's next-intl `defaultLocale` is `si`, so a bare path would send English readers to the Sinhala
document.

`nginx -t` → `syntax is ok` / `test is successful`.

## 3. Files deleted

- `govihub-umbrella/public/terms.html`
- `govihub-umbrella/public/terms-si.html`

Removed from the repo **and** from `/opt/govihub-umbrella/public/` on the VPS before the image
rebuild (the Dockerfile bakes `public/` in, so a stale file on disk would have been re-baked).

Not touched: `about.html`, `about-si.html`, `contact.html`, `contact-si.html`, `index.html`,
`si.html`, `privacy.html`, `assets/`.

## 4. Footer / nav changes

7 links repointed to canonical URLs directly, so normal navigation takes no redirect hop:

| Before | After | Count |
|---|---|---|
| `href="/terms"` | `href="https://spices.govihublk.com/en/terms"` | 4 |
| `href="/terms-si"` | `href="https://spices.govihublk.com/si/terms"` | 3 |

**Privacy links unchanged: 6 × `href="/privacy"`** — verified by count after the edit.

## 5. Smoke tests

### Redirects (no-follow)
```
/terms           301  https://spices.govihublk.com/en/terms
/terms.html      301  https://spices.govihublk.com/en/terms
/terms-si        301  https://spices.govihublk.com/si/terms
/terms-si.html   301  https://spices.govihublk.com/si/terms
```

### Followed
```
/terms     -> 200  /en/terms  h2=17
/terms-si  -> 200  /si/terms  h2=17
```

### Content proof — the live public Terms is the corrected canonical document

> **Methodology note:** the first content check produced a **false positive**. The naive test
> `"matching" in b and "AI-generated" in b` matched because canonical §10(c) legitimately says
> *"reliance on **AI-generated** guidance"*, and §2 says *"by **matching** harvest listings"*.
> Re-run against the actual clause text rather than loose substrings. Recording this because the
> first result would have read as a regression that was not there.

Actual §9, fetched from the redirect target:

> "Crop diagnosis, advisory answers, weather information, and match suggestions are generated by
> software, **including artificial intelligence for crop diagnosis and advisory answers.**"

→ AI is scoped to diagnosis and advisory. **Matching is NOT called AI.** ✅

Actual §11:

> "Nothing in these Terms excludes or limits liability for **fraud**, for **death or personal injury**
> caused by our own negligence, or for any other liability which cannot be excluded under the law of
> Sri Lanka."

→ UCTA carve-out present verbatim. ✅

Explicit bad-claim scan on the live body — **all False**:
`match suggestions are AI` · `matching suggestions are AI-generated` · `preceding 12 months` ·
`courts of Colombo`

### Unchanged surfaces
```
govihublk.com/privacy                 200   (baseline preserved; still contains 2026-04-17)
govihublk.com/about                   200
govihublk.com/contact                 200
govihublk.com/si                      200
govihublk.com/                        200
spices.govihublk.com/en/terms         200   (unaffected)
spices.govihublk.com/si/terms         200   (unaffected)
TLS govihublk.com valid, expires Sep 15 07:08:03 2026 GMT — 57 days
```

## 6. Spices stack untouched — proof

Container `StartedAt` captured before the umbrella deploy and again after. **Byte-identical:**

| Container | Before | After |
|---|---|---|
| `govihub-spices-govihub-api-spices-1` | `2026-07-19T16:58:21.552612446Z` | `2026-07-19T16:58:21.552612446Z` |
| `govihub-spices-govihub-web-spices-1` | `2026-07-19T16:58:19.825989793Z` | `2026-07-19T16:58:19.825989793Z` |
| `govihub-spices-postgres-spices-1` | `2026-06-15T08:06:18.02642424Z` | `2026-06-15T08:06:18.02642424Z` |
| `govihub-spices-redis-spices-1` | `2026-06-15T08:06:18.114529457Z` | `2026-06-15T08:06:18.114529457Z` |
| `govihub-umbrella` | — | `2026-07-19T18:09:25.659696944Z` (expected) |

Only `docker-compose.umbrella.yml` was invoked. No spices compose, no DB, no migration, no MCP, no
Traefik change. Postgres and Redis have been up 4 weeks continuously and still are.

## 7. R3 closure

**The two-terms conflict is resolved.** One canonical document — the in-app Terms at
`spices.govihublk.com/[locale]/terms` — governs the platform. It is the legally operative copy:
click-wrapped at registration, version-tracked in `users.tos_version`, backed by live migration 014.
The umbrella path is a permanent 301 to it, and the umbrella copy is deleted, so the two texts can no
longer drift apart.

## 8. Carried forward

- **`/privacy` is its own item.** Umbrella `/privacy` status at STEP 0 and after: **200, unchanged**,
  still dated `2026-04-17`. **Deliberately not redirected** — the app `/privacy` is a known 404
  (audit D6), so redirecting would send users to a dead page. It also still contradicts the code
  (claims hard delete; `users.deleted_at` is a soft delete) and broadly denies advertising use of
  data while ads are first-party targeted by role and district. PDPA privacy-notice task still open.
- **Attorney review of the canonical Terms still pending** — but counsel now reviews **one**
  document, not two. Flag §9 (narrowed AI claim) and §11 (carve-out) first.
- Sinhala/Tamil review: `tos.si.md` pending Aruni; `tos.ta.md` has no assigned reviewer.
- **Plaintext production admin credential** in `e2e-v3/test-all.js:20`, git-tracked and pushed —
  unrelated to this change, still the highest-priority open item.

## 9. Rollback

Limited to the umbrella routing config and two HTML files; the spices stack is untouched throughout.
Revert `govihub-umbrella/nginx.conf`, restore `terms.html` and `terms-si.html` from `61b32d4^`,
`scp` to `/opt/govihub-umbrella/public/`, then `build --no-cache` + `up -d --force-recreate` on
`docker-compose.umbrella.yml`.
