# TAMIL_APP_VERIFICATION.md

**Loop:** `CC_TAMIL_LOOP.md` — P1 measure → P2 translate → P3 names/font → P4 reviewer pack → P5 lived experience → P6 deploy
**Target:** `spices.govihublk.com` · branch `spices` · state `/opt/govihub-spices/.cc_state/tamil_loop.json`
**Completed:** 2026-08-25 · **Live on production**

| Phase | Status |
|---|---|
| **P1** measure | ✅ inventory recorded before any translation |
| **P2** translate | ✅ 547 keys, GT.1–GT.4 green |
| **P3** names + font | ✅ crops already done, districts documented, GT.6 proven |
| **P4** reviewer pack | ✅ **approved by the reviewer with zero corrections** |
| **P5** lived experience | ✅ 49/49 checks, local **and** prod |
| **P6** deploy + cleanup | ✅ live, baselines restored exactly |

---

## The headline

A Tamil speaker can now register, log in, and use every core flow in Tamil. Coverage went from
**11.5% to 100%** of the app's 620 user-facing strings, and the reviewer approved the drafts without
a single correction.

```
ta.json   271 -> 620 keys        71 -> 618 values carrying real Tamil
                                 (the 2 non-Tamil values are deliberate, see GT.3)
```

## P1 — what was actually measured

No prior counts were trusted. `scripts/tamil_inventory.py` → `tamil_inventory.json`.

```
en keys 620 | ta keys 271 | si keys 620
missing from ta               349
present but no Tamil chars    198
  -> TOTAL NEEDING WORK       547   (11.5% coverage)
already real Tamil (kept)      71
interpolation mismatches        0
```

**Four things the loop spec treated as work were already done.** Measuring first is what stopped
them being rebuilt:

- `ta` was already in `middleware.ts` locales.
- The language switcher already exposed Tamil as **தமி**.
- `globals.css` already imported **Noto Sans Tamil** 400–700, and Tailwind's `sans` stack included it.
- All 8 spice names already had real Tamil in **`crop_taxonomy.name_ta`** — note the table is
  `crop_taxonomy`, *not* `crops`.

## P2 — translation

547 keys through the **gemini-translate** skill (`gemini-2.5-flash`) in 27 module-scoped chunks,
530.8s. Each chunk carried real screen context ("farmer dashboard: harvest listings, prices,
matches") rather than a bare word list.

```
GT.1  key parity                 PASS   0 missing
GT.2  interpolation parity       PASS   0 mismatches file-wide
GT.3  no untranslated leftovers  PASS   0 non-whitelisted ta == en
GT.4  parses + Tamil in sample   PASS   0/20 sampled values lacked Tamil
```

Zero placeholder failures across all 27 chunks — the driver validates the `{token}` set per key and
refuses any value that changes it, so a mistranslation can never break a screen.

**One key needed a judgment call.** `auth.phonePlaceholder` is the digit mask `07X XXX XXXX`.
`si.json` keeps it identical, so Tamil does too: it was **whitelisted, not translated**, and added
so key parity is real. GT.1 passes because the key exists — not because the gate was loosened.

`scripts/tamil_translate.py` is idempotent: it recomputes the work set from the current `ta.json`
every run and writes after **every** chunk, so an interrupted run costs one chunk, not the run.

## P3 — names and font

**Crops: no work needed.** All 8 spices already carried Tamil.

| Cardamom ஏலக்காய் | Cinnamon இலவங்கப்பட்டை | Clove கிராம்பு | Ginger இஞ்சி |
|---|---|---|---|
| **Mixed Spices** கலவை மசாலா | **Nutmeg** ஜாதிக்காய் | **Black Pepper** மிளகு | **Turmeric** மஞ்சள் |

**Districts: documented, not invented.** There is no per-locale mechanism — hardcoded English arrays
in 5 page files, no shared constant, no DB table, no locale keys. Per the loop's own decision rule a
mechanism was deliberately **not** built.

> ⚠️ **Pre-existing defect found while measuring, unrelated to Tamil.** The five district arrays
> disagree with each other: `beta-login` 25, `register` 25, `farmer/settings` 25,
> **`buyer/settings` 21**, **`supplier/settings` 18**. Sri Lanka has 25 districts, so buyer settings
> is missing 4 and supplier settings 7. Recorded, not fixed — out of scope here.

Smaller gaps, also documented: the `tools` supply category has no locale key, and units `kg` / `set`
render raw.

```
GT.5  Tamil crop names served, districts finding documented   PASS
GT.6  document.fonts.check('16px "Noto Sans Tamil"') = true   PASS  (mobile + desktop, local + prod)
```

## P4 — reviewer pack

`TAMIL_REVIEW_PACK.xlsx` — 30 sheets, 620 strings + 8 database crop names, one artifact so the
reviewer never needed a second document. Every row marked **new draft** (549) / **already live** (59)
/ **previously staged** (12), with the 12 drafts from `TAMIL_REVIEW_PENDING.md` folded in. The
guidance sheet carries the dialect rule (Sri Lankan, not Indian Tamil — இலக்கம் over எண்), register,
length, and the warning to preserve `{placeholders}`.

**Outcome: approved with zero corrections.** The committed `ta.json` is final and the corrections
round was skipped.

`scripts/apply_tamil_corrections.py` is **kept and archived** for future edits. It was round-trip
tested before being shelved: a valid correction applies, and one that drops a `{placeholder}` is
**rejected** rather than allowed to break a screen. Its runbook is at
`/opt/govihub-spices/.cc_state/tamil_corrections_prompt.md`.

## P5 — lived experience

`e2e-v3/tamil-gates.js`. UI navigation only, no API shortcuts — the point is proving a person can
get through the app, not that the endpoints answer. Two viewports (390×844 and 1280×800), run
locally first, then against production.

```
GP.1  /ta registration end to end -> /ta/farmer/dashboard        PASS
      country picker present, first option LK
      ToU click-wrap checked; form renders Tamil
GP.2  duplicate phone -> Tamil DUPLICATE_PHONE at the field      PASS
GP.3  dashboard / weather / diagnosis render Tamil               PASS
GP.4  marketplace browse + detail view render Tamil              PASS
GP.5  settings language ta->si->en->ta persists after reload     PASS
GP.6  no horizontal overflow on any screen                       PASS
GP.7  English-leak probe, 15 common UI words                     PASS  none
GP.8  screenshots saved                                          PASS  18 prod / 20 local
```

**49/49 checks passed locally and 49/49 on production.**

Screenshots: `screenshots/tamil/prod/` and `screenshots/tamil/local/`
Machine-readable results: `tamil_gate_results_prod.json`, `tamil_gate_results_local.json`

### Three harness bugs that looked like product bugs

Worth recording, because each one first presented as a Tamil failure and none of them were:

1. **GP.1 "registration is broken."** It wasn't. The API returned a precise
   `422 username TOO_LONG, Maximum 20 characters` — my generated username `ta_gate_desktop_12345678`
   was 24 characters. Shortened to a 15-character `tgate_` form, which doubles as the cleanup key.
2. **A malformed phone.** The country picker already supplies `+94`, so filling `0771234567`
   submitted as `+94 077 123 4567`. Sri Lankan mobiles behind the picker are 9 digits starting `7`,
   no leading zero.
3. **GP.5 "no language switcher."** It was looking at the landing page. The persisted control is a
   radio group on the **settings** page, and it was also cascading from GP.1 — a failed registration
   meant no session, so settings rendered the login page instead.

The product returned a correct, specific, structured error in every case. Reading the actual API
response instead of guessing is what turned three dead ends into three one-line fixes.

## P6 — deploy and cleanup

Locale JSON is baked into the Next.js build, so a restart is not enough:

```
docker compose -f docker-compose.spices.yml build --no-cache govihub-web-spices
docker compose -f docker-compose.spices.yml up -d govihub-web-spices
```

The admin container is a bind mount and was **not** touched. The API was not rebuilt — no backend
code changed.

### Cleanup — FK-safe, dry run first

`scripts/tamil_cleanup.sh` discovers FK references **dynamically** instead of assuming a table list,
so a table added later cannot silently orphan rows. It scanned 21 tables referencing `users` and
found live references in exactly two — including `notification_preferences`, which a hand-written
list would have missed.

It also refuses to run if any row matching the `tgate_` prefix does not match the exact harness
pattern `tgate_[md]########`, so it cannot reach a real account.

```
targets  2 (tgate_m74377714, tgate_d74439148 — both created by the prod gate run)
deleted  farmer_profiles 2 · notification_preferences 2 · users 2
```

### Baselines restored exactly

```
                 at start   after gates   after cleanup
users               204        206            204   ✅
supply_listings       7          7              7   ✅
harvest_listings     21         21             21   ✅
tables               29                        29   ✅
alembic head        015                       015   ✅
tgate_ rows           0          2              0   ✅
```

Backup before cleanup: `/root/backups/pre-tamil-cleanup-20260825-161625.sql`

### Post-deploy verification

```
full-surface smoke   29/29 PASS
/ta /si /en /ta/auth/beta-login   all 200
GT.1-GT.4 re-run against the production tree   ALL PASS
GP.1-GP.8 + GT.6 against production            49/49 PASS
```

## Correction to an earlier handoff note

A previous handoff claimed the local dev API is on **8012** and that `CLAUDE.md` was stale for saying
8002. That was wrong. The plain `docker-compose.dev.yml` publishes **8002**, exactly as `CLAUDE.md`
says; 8012 came from an untracked `docker-compose.dev.local.yml` override that happened to be in use
that day. `CLAUDE.md` is correct — check which compose file is active before trusting either number.

## Still open

1. **District arrays disagree** (25/25/21/25/18). Buyer and supplier settings are missing districts.
   Pre-existing, unrelated to Tamil, out of scope for this loop.
2. **Districts render in English** on Tamil screens by design, since no per-locale mechanism exists.
   Building one is a separate decision.
3. **`tools` category and `kg`/`set` units** have no locale keys.
4. **The 620 strings are machine drafts the reviewer approved wholesale.** Approval with zero
   corrections across 549 new drafts is a strong result, but real usage by farmers in Anuradhapura
   and Polonnaruwa is the test that matters.

## Artifacts

| What | Where |
|---|---|
| Inventory | `tamil_inventory.json`, `scripts/tamil_inventory.py` |
| Translation driver | `scripts/tamil_translate.py`, `tamil_translate_progress.json` |
| GT gate checker | `scripts/tamil_gates.py` |
| Reviewer pack | `TAMIL_REVIEW_PACK.xlsx` (approved, 0 corrections) |
| Corrections script (archived) | `scripts/apply_tamil_corrections.py` |
| Corrections runbook | `/opt/govihub-spices/.cc_state/tamil_corrections_prompt.md` |
| P5 harness | `e2e-v3/tamil-gates.js`, `e2e-v3/tamil-diag.js` |
| Gate results | `tamil_gate_results_prod.json`, `tamil_gate_results_local.json` |
| Screenshots | `screenshots/tamil/prod/` (18), `screenshots/tamil/local/` (20) |
| Cleanup | `scripts/tamil_cleanup.sh` |
| State | `/opt/govihub-spices/.cc_state/tamil_loop.json` |
