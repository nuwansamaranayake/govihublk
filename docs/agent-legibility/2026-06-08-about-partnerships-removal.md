# Truth-Layer Audit — Remove "Partnerships" section from About page

- **Date:** 2026-06-08
- **Surface:** `govihublk.com/about` + `/about-si` (umbrella static site)
- **Change type:** Removal of public claims (truth-positive)
- **Trigger:** Public-facing copy change naming third-party organizations

## Diagnosis

The About page claimed active partnerships with two named, well-known
organizations — **DevPro Sri Lanka** and **OXFAM Sri Lanka** — in three
places per language version:

1. `<meta name="description">` — stated as fact: *"Partnered with DevPro and OXFAM."*
2. Visible `<h2>Partnerships</h2>` section — *"GoviHub is building in partnership with…"* + named list.
3. (Unchanged) generic word "partnerships" in unrelated sentences that name no org.

The meta-description instance was the highest-risk surface: it is what search
snippets, social cards, and scrapers/agents ingest first, and it phrased an
unproven relationship as completed fact ("Partnered with").

## Truth Layer (canonical, post-change)

- GoviHub is built by **AiGNITE Consulting** (Houston-based, Sri Lanka branch).
- The platform is engineered in the US; Sri Lanka runs onboarding, Sinhala
  content, and field operations.
- Pilot focus: Anuradhapura & Polonnaruwa (dry zone). Spices sector live.
- **No external organizational partnership is currently claimed.** The Contact
  page invites partnership/collaboration inquiries (a channel, not a claim).

## Claims / Evidence Map

| Claim (before) | Evidence on file | Verdict |
|---|---|---|
| "Partnered with DevPro and OXFAM" (meta, stated as fact) | None provided | **Removed** — unsupported, high credibility-borrowing risk |
| "building in partnership with DevPro Sri Lanka / OXFAM Sri Lanka" (body) | None provided | **Removed** — unverified named-partner claim |
| "open to collaborations with cooperatives, NGOs, public-sector" (invitation) | N/A (aspiration, not a claim) | Removed from About; equivalent intent already served by Contact page "Partnership inquiry" channel |
| Generic "partnerships" wording (team bio, ops, roadmap) | Names no org | **Kept** — not an over-claim |

## AI-Washing Risk Register

- **Direction of this change: risk-reducing.** Removing named, unproven
  partnerships with established NGOs (especially OXFAM, an international brand)
  eliminates a borrowed-credibility / over-claiming exposure. If those
  relationships are not formalized, the prior copy was a trust and potential
  legal/reputational liability.
- No new claims introduced.

## Human Memory Layer

- The page's memorable wedge — *"rebuilt around the farmer, not the
  middleman,"* Sinhala-first, "youth return to farming when farming returns a
  fair income" — is untouched. None of it depended on the partnership name-drop.

## Agent Surface Plan

- **About (EN + SI):** meta description + visible section removed. ✅ shipped.
- **Contact (EN + SI):** no org names present; generic "Partnership inquiry"
  channel retained — consistent, no change needed.
- **Cross-surface check:** grep of umbrella `public/` confirms no remaining
  `OXFAM` / `DevPro` references on any page after the change.

## Technical Deliverables Backlog (future, optional)

- If real partnerships are later signed: re-add with evidence (MOU date, scope,
  logo usage permission) rather than a bare name list.
- Consider a `llms.txt` / JSON-LD pass for the umbrella site so the canonical
  truth layer above is explicitly agent-readable.

## Implementation record

- Edited: `govihub-umbrella/public/about.html`, `about-si.html` (meta + section).
- Deployed: scp → `/opt/govihub-umbrella/public/` on `govihub-mumbai`, rebuilt
  `govihub-umbrella:v1` image, recreated container (stateless, no data loss).
- Verified live: `/about` & `/about-si` HTTP 200, 0 OXFAM/DevPro/section,
  surrounding content intact, TLS HTTP/2 200. Byte size dropped 3243→2686 (EN),
  5358→4389 (SI), confirming the section is gone in production.
