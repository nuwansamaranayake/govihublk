# Beta Notice — Sinhala Translations for Aruni's Review

**Date:** 2026-04-17
**Status:** Deployed using the plan's fallback copy. Aruni, please review and flag anything unnatural — I'll ship an update if you want changes before Sunday.

## Strings in `si.html`

| Key | English source | Sinhala used | Aruni please check |
|---|---|---|---|
| title | GoviHub — Beta Complete | GoviHub — බීටා අවසන් | Short, fits browser tab. OK? |
| heading | Beta testing is complete. Thank you. | බීටා පරීක්ෂණ කාර්යය නිමා වී ඇත. ස්තූතියි. | Natural tone? Warm enough? |
| body | You helped us build GoviHub. We are grateful. Our spices platform is now live. | ඔබ අපට GoviHub ගොඩනැගීමට උදව් කළා. අපේ කුළුබඩු වේදිකාව දැන් සක්‍රියයි. | "සක්‍රියයි" vs "ජීවත්ව ඇත" vs "දැන් ක්‍රියාත්මකයි" — which is most natural for "is now live"? |
| cta | Visit GoviHub Spices → | GoviHub කුළුබඩු වෙත පිවිසෙන්න → | OK to keep brand name in Latin? |
| secondary | Fruits and produce platforms coming soon. Visit govihublk.com for updates. | පළතුරු සහ එළවළු වේදිකා ඉදිරියේදී. නව තොරතුරු සඳහා govihublk.com බලන්න. | "පළතුරු සහ එළවළු" or "පළතුරු හා එළවළු"? |
| footer (contact) | Contact support@govihublk.com · govihublk.com | අමතන්න support@govihublk.com · govihublk.com | "අමතන්න" vs "සම්බන්ධ වන්න"? |
| meta description | GoviHub beta testing is complete. Visit the live spices platform. | GoviHub බීටා පරීක්ෂණය නිමයි. කුළුබඩු වේදිකාව වෙත පිවිසෙන්න. | For SEO — OK? |

## Font stack

`font-family: "Noto Sans Sinhala", "Iskoola Pota", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;`

Noto Sans Sinhala is on Android Chrome by default. Iskoola Pota covers Windows. iOS picks up system Sinhala fallback. **Please open the page on a real Sri Lankan Android phone and confirm no tofu boxes (□) appear.**

## If you want to change anything

Ping me (Nuwan) with the exact replacement string. I'll rebuild the notice container and redeploy in < 2 minutes.
