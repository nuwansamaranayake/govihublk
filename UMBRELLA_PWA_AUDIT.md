# UMBRELLA_PWA_AUDIT.md

**Date:** 2026-04-17 (continuation of same night launch push)

## Part 1 — Asset audit

### `/assets/` at repo root

```
assets/
├── govihub-spices/
│   ├── DEPLOY_PWA_ICONS.md       (previous deploy instructions)
│   ├── icon-192x192.png           ← SPICES-BRANDED PWA icon (37 KB)
│   ├── icon-512x512.png           ← SPICES-BRANDED PWA icon (166 KB, PNG RGBA 512×512)
│   └── manifest.json              (previous spices manifest draft)
└── logo-kit/
    ├── LOGO-KIT-GUIDE.html
    ├── app-icons/
    │   ├── android/     (7 files: 48/72/96/144/192/adaptive-432/playstore-512)
    │   ├── desktop/
    │   ├── favicon/     (apple-touch 180, favicon.ico, 16/32/48/64)
    │   └── ios/         (1024 + standard iOS sizes)
    ├── promotional/     (letterhead, email, business-card)
    ├── social-media/
    └── variants/
        ├── dark-bg/         (dark-variant logos 500/1000/2000w, icons 200/500/1000)
        ├── icon-only/       (64/128/256/512/1024 + original clean/transparent)
        ├── transparent/     (full-logo 200/500/1000/2000w + icon 100/200/500/1000)
        └── white-bg/        (white-variant parallel)
```

**Finding:** A spices-specific variant already exists at `assets/govihub-spices/icon-192x192.png` and `icon-512x512.png`. These are the assets Nuwan referenced. **No Gemini generation needed for Part 5 PWA icon.**

No 192 maskable exists — will generate via ImageMagick from the 512 spices icon with 10% padding.

### Current PWA state (`govihub-web/public/`)

- `manifest.json` currently reads `"name": "GoviHub — Sri Lanka's AI Farming Marketplace"` (generic — needs rebrand to spices)
- `icons/` contains generic 192, 512, maskable-512, icon.svg, favicon-16/32/48, apple-touch-icon
- No `icon-maskable-192x192.png` yet

### Generic logo (for umbrella site)

The umbrella site uses the generic GoviHub brand:
- `assets/logo-kit/variants/transparent/full-logo-500w.png` or 1000w — best for site header
- `assets/logo-kit/app-icons/favicon/favicon.ico` — site favicon

### Next actions

- Part 2: generate 4 umbrella landing images via Gemini (hero + 3 tiles)
- Part 5: replace PWA icons with `assets/govihub-spices/*` + generate maskable-192 from the 512
- Part 5: update manifest + layout metadata + header component
