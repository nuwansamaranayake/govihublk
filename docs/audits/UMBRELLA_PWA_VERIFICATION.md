# UMBRELLA_PWA_VERIFICATION.md

**Date:** 2026-04-17 (continuing the Friday-night SL-overnight launch push)
**Status:** ✅ READY

---

## Umbrella site (govihublk.com)

| Endpoint | Expected | Actual |
|---|---|---|
| `https://govihublk.com/` | 200, EN landing | 200 ✓ |
| `https://govihublk.com/si` | 200, SI landing | 200 ✓ |
| `https://govihublk.com/about` | 200 EN | 200 ✓ |
| `https://govihublk.com/about-si` | 200 SI | 200 ✓ |
| `https://govihublk.com/contact` | 200 EN | 200 ✓ |
| `https://govihublk.com/contact-si` | 200 SI | 200 ✓ |
| `https://govihublk.com/privacy` | 200 | 200 ✓ |
| `https://govihublk.com/terms` | 200 | 200 ✓ |
| `https://www.govihublk.com/` | 3xx → apex | 308 → `https://govihublk.com/` ✓ |
| `/assets/images/hero-sri-lanka-farming.jpg` | 200 | 200 ✓ |
| `/assets/images/tile-spices.jpg` | 200 | 200 ✓ |
| `/assets/images/tile-fruits.jpg` | 200 | 200 ✓ |
| `/assets/images/tile-produce.jpg` | 200 | 200 ✓ |

Content smoke checks (via VPS curl to avoid local Windows cert quirks):
- EN landing contains "Sri Lanka"
- SI landing contains "කුළුබඩු"

Features shipped:
- Bilingual EN / SI with sticky header, hero with gold CTA, three-card "what we do" block
- Three sector tiles (Spices live / Fruits & Produce "Coming Soon" badge)
- Notify-me mailto capture on fruits + produce tiles (v2 TODO: POST /api/v1/interest-signups)
- About strip + dedicated about, contact, privacy, terms pages
- Language toggle with localStorage preference, clean URL routes via nginx
- Brand: green #2D6A2E primary, gold #E8A838 accent, no brown
- Mobile-first layout, 44 px minimum tap targets, images sized for 360 px viewport

### DNS

```
govihublk.com        → 187.127.135.82 (Mumbai VPS) ✓
www.govihublk.com    → CNAME govihublk.com (same IP) ✓
```

### Container

```
NAMES              STATUS         PORTS
govihub-umbrella   Up             0.0.0.0:3005->80/tcp
```

Compose file at `/opt/docker-compose.umbrella.yml`, built from `/opt/govihub-umbrella/`. Traefik discovers it via docker socket labels.

---

## Spices PWA (spices.govihublk.com)

### Manifest

```json
GET https://spices.govihublk.com/manifest.json
{
  "name": "GoviHub Spices",
  "short_name": "GoviHub Spices",
  "description": "Sri Lanka's AI farming marketplace for spices. ...",
  "theme_color": "#2D6A2E",
  "background_color": "#FFFFFF",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait",
  "lang": "en",
  "categories": ["business", "productivity", "agriculture"],
  "icons": [
    any-192, any-512, maskable-192, maskable-512
  ]
}
```

### Icon availability

| URL | HTTP |
|---|---|
| `/icons/icon-192x192.png` | 200 ✓ |
| `/icons/icon-512x512.png` | 200 ✓ |
| `/icons/icon-maskable-192x192.png` | 200 ✓ (new, generated with 10% safe-zone padding) |
| `/icons/icon-maskable-512x512.png` | 200 ✓ (regenerated with 10% padding) |
| `/icons/apple-touch-icon.png` | 200 ✓ (180×180 derived from spices 512) |
| `/icons/favicon-16x16.png` | 200 ✓ |
| `/icons/favicon-32x32.png` | 200 ✓ |
| `/icons/favicon-48x48.png` | 200 ✓ |
| `/favicon.ico` | 200 ✓ (multi-res 16/32/48 ICO) |

### HTML

- `<title>` → `GoviHub Spices — Sri Lanka's AI Farming Marketplace` ✓
- `<meta name="theme-color" content="#2D6A2E">` ✓
- `<link rel="manifest" href="/manifest.json">` ✓
- `<html lang={locale}>` still honors `en` / `si` per route ✓

### Header component

`govihub-web/src/components/ui/TopBar.tsx` now renders, when no custom title or left action is supplied:

```
[spices-icon-28]  GoviHub
                  SPICES    (uppercase gold)
```

Translation key `brand.sectorSpices` added in en/si/ta.

### No regressions

- `/login`, `/beta-login` still load
- Smoke-test endpoints from the prior session's LAUNCH_VERIFICATION.md still 200

---

## Git

**Branch:** `spices` (renamed from `beta-auth`)

**Commits pushed (this session):**

```
92ccbef feat(spices-pwa): rebrand PWA identity to GoviHub Spices
147f3f5 feat(umbrella): add govihublk.com marketing site
```

Pushed to `origin/spices` (the active branch, renamed from `beta-auth`). Working tree still has pre-existing uncommitted changes from earlier sessions (backend API, page components, help translations) — those were intentionally left alone and not bundled into the umbrella/PWA commits.

---

## Known flags (not blockers)

1. **Privacy and Terms are placeholder**. Draft pending legal review. Acceptable for the Sunday announcement; needs counsel review before wide promotion.
2. **Sinhala copy is fallback**. Aruni should review — flagged in `UMBRELLA_TRANSLATION_REVIEW.md` and on each string in the SI pages.
3. **Email capture is mailto-only**. Works but not trackable. v2: POST `/api/v1/interest-signups` endpoint on spices API writing to a new `interest_signups` table. TODO comment is in both tile forms.
4. **WhatsApp number** on contact pages is a placeholder — Nuwan to provide.
5. **Maskable 512** was regenerated with 10% padding. Existing PWA installs on users' phones will pick up the new icon on their next visit (Next.js refetches the manifest on load; actual icon swap happens on re-install for already-installed users).
6. **Ads router + MCP stats fixes** from the prior session's LAUNCH_VERIFICATION are on the VPS but not yet merged to `main` (they're committed to `spices` via the earlier commits on the branch — originally authored under the `beta-auth` name before the rename). Merge once sanity tests pass on Saturday.

---

## Hand-off to Nuwan

- Visit `https://govihublk.com/` to see the EN landing. Flip to `/si` for the Sinhala version.
- Visit `https://spices.govihublk.com/` and "Install to home screen" on an Android phone. The installed icon and app name should now read **GoviHub Spices** with the spices-branded logo.
- Pre-existing installs refresh on next visit — manifest served with short TTL + `maxAge=0` on HTML paths.
- The beta notice page and the Part-11 sanity test checklist from the prior session remain the critical path for Sunday's announcement. Nothing here should affect those.

## Preview panel artefacts

Each umbrella HTML file rendered and was posted into the Claude Code preview panel as it was written:
- `index.html`, `si.html`, `about.html`, `about-si.html`, `contact.html`, `contact-si.html`, `privacy.html`, `terms.html`
