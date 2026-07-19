# UMBRELLA_TERMS_AUDIT.md — STEP 0

**Date:** 2026-07-19 · **Branch:** `spices` · **Scope:** umbrella stack only
**Status:** Audit complete. **The spec's central premise no longer holds. Stopped before Part 1, per
the spec's own instruction to halt on contradiction.**

---

## ⚠️ DEVIATION 1 — the legal conflict this spec exists to remove is already gone

The spec states:

> "The umbrella still serves a full, older, contradictory ToS dated 2026-04-17 at `govihublk.com/terms`.
> The two documents disagree on the AI claim … and on the liability clause … Two binding terms that
> disagree on liability is a live legal conflict. This change removes it."

**That was true this morning. It was fixed roughly an hour before this spec was received.**
`govihublk.com/terms` now serves the **canonical v1.1 text** — the same document as the app.

Live evidence (fetched 2026-07-19, this audit):

| URL | Status | Stale markers | Canonical markers |
|---|---|---|---|
| `govihublk.com/terms` | **200** | **none** | 3/3 |
| `govihublk.com/terms.html` | **200** | **none** | 3/3 |
| `govihublk.com/terms-si` | **200** | **none** | Sinhala (EN markers N/A) |

Markers scanned for: `matching suggestions are AI-generated`, `preceding 12 months`, `2026-04-17`,
`Note to counsel` → **all absent from /terms**.
Canonical markers found: `What We Do Not Exclude` (the UCTA carve-out), `Version 1.1`, `Your Content`.

So specifically, the two defects the spec names are **already corrected on the umbrella**:
- the AI claim is bounded to crop diagnosis and advisory answers (matching is no longer called AI)
- liability is v1.1 §10 + **§11 carve-out** (fraud, death, personal injury) — the 12-month fee cap is gone

**The conflict was resolved by convergence, not retirement:** both surfaces now publish identical
v1.1 text. See `TOS_DISCLAIMER_VERIFICATION.md` §9.

## ⚠️ DEVIATION 2 — a Sinhala umbrella terms page now exists

The spec anticipates "any Sinhala variant … or similar" as a possibility. It exists as of today:
`terms-si.html`, served at `govihublk.com/terms-si`, with its own nginx block, linked from the three
Sinhala pages. It did not exist when the spec was written.

## ⚠️ DEVIATION 3 — v1.1, not v1.0

The spec refers to "canonical §7 plus §8" as the liability clauses. Those were the v1.0 numbers.
Canonical is now **v1.1 (17 sections)**: liability is **§10**, the carve-out is **§11**, the AI
clause is **§9**. Three clauses (content licence, eligibility, prohibited uses) were merged in from
the old umbrella draft precisely because canonical lacked them.

---

## STEP 0 findings (recorded as instructed)

### 1. Deployment
| Item | Value |
|---|---|
| Compose file | `/opt/docker-compose.umbrella.yml` (on `govihub-mumbai`) |
| Container | `govihub-umbrella` · image `govihub-umbrella:v1` |
| Web root | `/usr/share/nginx/html` (Dockerfile **bakes** `public/` into the image) |
| Routing | **nginx inside the container**, fronted by Traefik for TLS/host routing. Per-path control is nginx's. |
| nginx config | `govihub-umbrella/nginx.conf` in repo → baked into image |
| Deploy path | **`/opt/govihub-umbrella` is NOT a git repo** — files are `scp`'d, then image rebuilt + container recreated |
| Branch | `spices` (confirmed) · deployed commit `31a7fe4` |

**Per the spec's preference ("Prefer nginx if both are available"), nginx is the correct layer.**

### 2. How `/terms` resolves — verbatim mechanism

**Not** `try_files $uri $uri.html`. The config uses **explicit exact-match blocks per clean URL**,
with a catch-all `return 404`:

```nginx
location = /terms {
    add_header Cache-Control "public, max-age=300" always;
    try_files /terms.html =404;
}
```

Plus a **regex** block that serves any `.html` file directly:

```nginx
location ~ \.html$ {
    add_header Cache-Control "public, max-age=300" always;
    try_files $uri =404;
}
```

**Consequence the spec should know:** because of that regex block, **every page is reachable at both
`/x` and `/x.html`** — `/about.html`, `/privacy.html`, `/terms.html` all 200 today. This is why
`/terms.html` serves content despite having no exact-match block of its own.

**Implication for Part 1:** nginx precedence is `=` exact > regex `~` > prefix. So an added
`location = /terms.html { return 301 ...; }` **would** correctly beat the regex block. But note that
if `terms.html` is deleted (Part 2) *without* adding that exact block, `/terms.html` falls to the
regex block, the file is missing, and it returns **404 — not a redirect**. Both must land together.

### 3. Terms files in the web root
| File | Reached by |
|---|---|
| `terms.html` | `/terms` and `/terms.html` |
| `terms-si.html` | `/terms-si` and `/terms-si.html` |

### 4. Live prod status (this audit)
| URL | Status | Note |
|---|---|---|
| `/terms` | 200 | canonical v1.1 EN, 17 `<h2>` |
| `/terms.html` | 200 | same content |
| `/terms-si` | 200 | canonical v1.1 SI, 17 `<h2>`, 3867 Sinhala chars |
| `/privacy` | 200 | **untouched. Still contains `2026-04-17`.** Baseline for "unchanged" check |
| `/about` | 200 | |
| `/contact` | 200 | |

### 5. Footer / nav links to terms
| File | Links to |
|---|---|
| `public/index.html` | `/terms` |
| `public/about.html` | `/terms` |
| `public/contact.html` | `/terms` |
| `public/si.html` | `/terms-si` |
| `public/about-si.html` | `/terms-si` |
| `public/contact-si.html` | `/terms-si` |

(3 English → `/terms`, 3 Sinhala → `/terms-si`. The SI repointing was done today.)

### 6. Canonical targets — REQUIRED PRE-CHECK: **BOTH PASS**
| URL | Status | Sections |
|---|---|---|
| `spices.govihublk.com/en/terms` | **200** | 17 |
| `spices.govihublk.com/si/terms` | **200** | 17 |

Neither is a non-200, so the spec's STOP condition is not triggered on that count.

---

## The real remaining question

The spec's *stated* justification (a live legal conflict) is void. But its *underlying* goal —
"one document governs the platform" — is still worth deciding on, because convergence and retirement
solve it differently:

- **Today (convergence):** one *text*, two *copies* — markdown at `govihub-web/content/tos/` and HTML
  at `govihub-umbrella/public/`. Identical right now.
- **Spec (retirement):** one *location*; the umbrella path 301s to the app.

**The honest case for still doing the redirect — this is a hazard I introduced:** two copies must be
updated together forever. When v1.2 lands, whoever forgets the umbrella re-creates exactly the
conflict we just closed. A 301 makes that structurally impossible. And the app's copy is the
legally operative one — it is click-wrapped, version-tracked in `users.tos_version`, and backed by
migration 014. §15 resolves conflicts *between languages* but says nothing about *between surfaces*.

**The case against:** `govihublk.com` is the general marketing site; `spices.govihublk.com` is one
pilot product. Redirecting the corporate Terms into a pilot's subdomain is architecturally backwards,
and hard-codes "spices" into the brand site's legal surface. The umbrella also runs its own contact
form and privacy policy, so it is a distinct surface that arguably warrants its own terms page.

A third option the spec does not consider: **keep the umbrella page but generate it from
`tos.en.md` / `tos.si.md` at build time** — kills drift without redirecting off-brand.

**Not proceeding to Part 1 until this is decided.** Retiring a public URL also triggers the project's
Retirement Protocol, whose three questions are answerable here (users = marketing-site visitors;
migration path = app terms, verified 200; notification = arguably satisfied, since the redirect would
be fully transparent — the target now serves identical content) — but the decision should be made on
the merits above, not by default.
