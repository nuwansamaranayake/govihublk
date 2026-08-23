# Tamil review queue — pending

**Reviewer:** none assigned yet. This file is waiting for a Tamil reviewer to be appointed.
**Last updated:** 2026-08-23
**Source file:** `govihub-web/src/messages/ta.json`

## What this is

These are the Tamil strings now live in the GoviHub app that have **not been reviewed by a native speaker**. They were produced by machine translation. They are in front of real users today.

Whoever picks this up: your job is the **Correction** column. Read the English, read the current Tamil, and if the Tamil is wrong, awkward, or not what a Sri Lankan Tamil speaker would actually say, write the version you would use. Leave the cell blank if the current text is fine.

Two things to keep in mind:

- **Dialect.** This is for Sri Lankan Tamil speakers, not Indian Tamil. Where the two differ, use the Sri Lankan form. **இலக்கம்** rather than எண் for "number" is the kind of choice we want.
- **Register.** Users are farmers, buyers and suppliers in Anuradhapura and Polonnaruwa. Natural spoken Tamil beats formal written Tamil.

**Corrections are text-only.** Nothing here needs a code change. Hand this file back with the column filled in and the strings go straight into `ta.json`.

## Batch 1 — duplicate-registration errors (new, shipped 2026-08-23)

These appear inline under the relevant field when someone tries to register with a phone number or username that is already in use.

| Key | English | Current Tamil | Correction (leave blank) |
|---|---|---|---|
| `auth.phone_already_registered` | This phone number is already registered for this role. Log in instead, or use a different number. | இந்த தொலைபேசி இலக்கம் ஏற்கனவே இந்த வகைப் பாத்திரத்திற்கு பதிவு செய்யப்பட்டுள்ளது. அதற்குப் பதிலாக உள்நுழையவும் அல்லது வேறு இலக்கத்தைப் பயன்படுத்தவும். | |
| `auth.username_taken` | This username is taken. Choose another. | இந்த பயனர் பெயர் ஏற்கனவே உள்ளது. வேறு ஒன்றைத் தெரிவு செய்யவும். | |
| `auth.email_already_registered` | This email is already registered. Log in instead. | இந்த மின்னஞ்சல் ஏற்கனவே பதிவு செய்யப்பட்டுள்ளது. அதற்குப் பதிலாக உள்நுழையவும். | |

## Batch 2 — marketplace supplier + photos (shipped previous deploy, still unreviewed)

These are on the marketplace listing and supplier-detail screens.

| Key | English | Current Tamil | Correction (leave blank) |
|---|---|---|---|
| `marketplace.supplier_details` | Supplier details | வழங்குநர் விவரங்கள் | |
| `marketplace.call_supplier` | Call supplier | வழங்குநரை அழைக்கவும் | |
| `marketplace.whatsapp_supplier` | Message on WhatsApp | WhatsApp-ல் செய்தி அனுப்பவும் | |
| `marketplace.listing_photos` | Photos | புகைப்படங்கள் | |
| `marketplace.add_photos` | Add photos (up to 3) | புகைப்படங்களைச் சேர்க்கவும் (அதிகபட்சம் 3) | |
| `marketplace.photo_rules` | Up to 3 photos, each under 5MB. JPEG, PNG, or WebP. | அதிகபட்சம் 3 புகைப்படங்கள், ஒவ்வொன்றும் 5MB-க்கும் குறைவாக இருக்க வேண்டும். JPEG, PNG அல்லது WebP. | |
| `marketplace.photo_upload_failed` | Photo upload failed. Your listing was saved. Add photos again from Edit. | புகைப்படங்களைப் பதிவேற்ற முடியவில்லை. உங்கள் பட்டியல் சேமிக்கப்பட்டது. Edit திரையிலிருந்து மீண்டும் புகைப்படங்களைச் சேர்க்கவும். | |
| `marketplace.no_photos` | No photos | புகைப்படங்கள் இல்லை | |
| `auth.select_country` | Country | நாடு | |

## Open terminology question

`auth.phone_already_registered` above uses **வகைப் பாத்திரம்** for "role", matching the wording already in `auth_error_role_account_exists` and `auth_error_max_accounts`. The machine translation originally proposed **வகிபாகம்**, which is arguably the more idiomatic Sri Lankan Tamil administrative term. We kept the existing wording so the file has one vocabulary rather than two.

**Reviewer decision needed:** pick one term and we will apply it to all three keys at once.

## Coverage inventory — Tamil is far from complete

Measured against `en.json` on 2026-08-23. **This section is inventory only.** The Tamil implementation pass is a separate upcoming spec and is not part of this review. Do not treat the gap below as work for the reviewer.

| Measure | Count |
|---|---|
| Keys in `en.json` | 620 |
| Keys present in `ta.json` | 271 |
| Keys absent from `ta.json` entirely | 349 |
| Keys present but still an untranslated `[TA]` placeholder | 198 |
| **Total strings with no usable Tamil** | **547 of 620** |

Under the `auth` namespace specifically: **16 keys missing entirely** and **17 `[TA]` placeholders**, so 33 auth strings have no usable Tamil.

Note for whoever wrote the original estimate: the working figure of "~198 of 247 strings, including 23 missing auth keys" understated the gap. The 198 placeholder count is correct, but the denominator is 620 English keys rather than 247, and 349 keys are missing from `ta.json` altogether on top of the placeholders. The auth shortfall is 33, not 23.

Total pending review in this file: **11 strings.**
