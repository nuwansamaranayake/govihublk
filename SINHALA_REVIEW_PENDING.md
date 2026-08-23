# Sinhala review queue — pending

**For:** Dilsha Gunarathna
**Last updated:** 2026-08-23
**Source file:** `govihub-web/src/messages/si.json`

## What this is

These are the Sinhala strings now live in the GoviHub app that have **not yet been reviewed by a native speaker**. They were produced by machine translation and checked only for obvious errors. They are in front of real users today.

Your job is the **Correction** column. Read the English, read the current Sinhala, and if the Sinhala is wrong, awkward, too formal, or just not what a farmer would actually say, write the version you would use. Leave the cell blank if the current text is fine.

Two things to keep in mind:

- **Register.** GoviHub users are farmers, buyers and suppliers in Anuradhapura and Polonnaruwa. Natural spoken Sinhala beats textbook Sinhala. If a phrase reads like a government form, flag it.
- **Consistency.** We use ගැනුම්කරු for buyer and භූමිකාව for role throughout. If you would prefer different terms, say so once and we will change them everywhere.

**Corrections are text-only.** Nothing here needs a code change. Hand this file back with the column filled in and the strings go straight into `si.json`.

## Batch 1 — duplicate-registration errors (new, shipped 2026-08-23)

These appear inline under the relevant field when someone tries to register with a phone number or username that is already in use.

| Key | English | Current Sinhala | Correction (leave blank) |
|---|---|---|---|
| `auth.phone_already_registered` | This phone number is already registered for this role. Log in instead, or use a different number. | මෙම දුරකථන අංකය දැනටමත් මෙම භූමිකාව සඳහා ලියාපදිංචි වී ඇත. ඒ වෙනුවට පුරනය වන්න, නැතහොත් වෙනත් අංකයක් භාවිතා කරන්න. | |
| `auth.username_taken` | This username is taken. Choose another. | මෙම පරිශීලක නාමය දැනටමත් භාවිතයේ ඇත. වෙනත් එකක් තෝරන්න. | |
| `auth.email_already_registered` | This email is already registered. Log in instead. | මෙම විද්‍යුත් තැපෑල දැනටමත් ලියාපදිංචි වී ඇත. ඒ වෙනුවට පුරනය වන්න. | |

## Batch 2 — marketplace supplier + photos (shipped previous deploy, still unreviewed)

These are on the marketplace listing and supplier-detail screens.

| Key | English | Current Sinhala | Correction (leave blank) |
|---|---|---|---|
| `marketplace.supplier_details` | Supplier details | සැපයුම්කරුගේ විස්තර | |
| `marketplace.call_supplier` | Call supplier | සැපයුම්කරුට අමතන්න | |
| `marketplace.whatsapp_supplier` | Message on WhatsApp | WhatsApp හරහා පණිවිඩයක් යවන්න | |
| `marketplace.listing_photos` | Photos | ඡායාරූප | |
| `marketplace.add_photos` | Add photos (up to 3) | ඡායාරූප එකතු කරන්න (3ක් දක්වා) | |
| `marketplace.photo_rules` | Up to 3 photos, each under 5MB. JPEG, PNG, or WebP. | ඡායාරූප 3ක් දක්වා, එක් එක් 5MB ට අඩු විය යුතුය. JPEG, PNG, හෝ WebP. | |
| `marketplace.photo_upload_failed` | Photo upload failed. Your listing was saved. Add photos again from Edit. | ඡායාරූප උඩුගත කිරීම අසාර්ථක විය. ඔබගේ දැන්වීම සුරැකිණි. Edit වෙතින් නැවත ඡායාරූප එකතු කරන්න. | |
| `marketplace.no_photos` | No photos | ඡායාරූප නොමැත | |
| `auth.select_country` | Country | රට | |

## Specific questions

1. `marketplace.photo_upload_failed` leaves the word **Edit** untranslated because it names a button whose label is currently English in the UI. Should it stay English, or be translated to match what you would call that button?
2. `auth.phone_already_registered` uses **භූමිකාව** for role, matching `auth_error_role_account_exists` already in the file. Confirm that reads naturally to a farmer, or give us a better word.
3. **පුරනය වන්න** for "log in" — is that the term users would recognise, or is a borrowed form more familiar in practice?

Total pending: **11 strings.**
