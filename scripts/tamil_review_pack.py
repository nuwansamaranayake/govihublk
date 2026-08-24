"""P4: build TAMIL_REVIEW_PACK.xlsx — one artifact for the Tamil reviewer.

One sheet per module. Every user-facing Tamil string in the app appears exactly
once, including strings that were already live before this run and the drafts
previously staged in TAMIL_REVIEW_PENDING.md, so the reviewer never has to
consult a second document.

  python scripts/tamil_review_pack.py
"""
import io
import json
import os
import re
import sys

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MSG = os.path.join(ROOT, "govihub-web", "src", "messages")
OUT = os.path.join(ROOT, "TAMIL_REVIEW_PACK.xlsx")
PENDING = os.path.join(ROOT, "TAMIL_REVIEW_PENDING.md")
INVENTORY = os.path.join(ROOT, "tamil_inventory.json")

TAMIL_FONT = "Nirmala UI"  # ships with Windows, renders Tamil correctly in Excel

MODULE_DESC = {
    "common": "Shared buttons and labels used across every screen",
    "auth": "Registration and login",
    "home": "Landing page",
    "farmer": "Farmer dashboard: harvest listings, prices, matches",
    "buyer": "Buyer dashboard: browsing harvests, contacting farmers",
    "supplier": "Supplier dashboard: seeds, fertiliser, equipment",
    "marketplace": "Marketplace for farm supplies",
    "diagnosis": "AI crop disease diagnosis from a leaf photo",
    "weather": "Weather forecast and rainfall alerts",
    "matches": "Automatic buyer-to-farmer matching",
    "alerts": "Notifications and warnings",
    "ads": "Advertisements shown to farmers",
    "crops": "Spice crop names and growing information",
    "settings": "Account settings",
    "tos": "Terms of use and legal text",
    "roles": "User role names",
    "nav": "Navigation menu",
    "errors": "Error messages",
}


def flatten(obj, prefix=""):
    out = {}
    for k, v in obj.items():
        key = prefix + "." + k if prefix else k
        if isinstance(v, dict):
            out.update(flatten(v, key))
        else:
            out[key] = v
    return out


def load(name):
    with io.open(os.path.join(MSG, name), encoding="utf-8") as f:
        return flatten(json.load(f))


def staged_keys():
    """Keys already queued for review in TAMIL_REVIEW_PENDING.md."""
    if not os.path.exists(PENDING):
        return set()
    text = io.open(PENDING, encoding="utf-8").read()
    return set(re.findall(r"\|\s*`([a-zA-Z0-9_.]+)`\s*\|", text))


def crop_names():
    """P3 names that live in the DB, not the locale file. Captured 2026-08-24."""
    return [
        ("crop_taxonomy.SPC-CDM-001", "Cardamom", "ஏலக்காய்"),
        ("crop_taxonomy.SPC-CIN-001", "Cinnamon", "இலவங்கப்பட்டை"),
        ("crop_taxonomy.SPC-CLV-001", "Clove", "கிராம்பு"),
        ("crop_taxonomy.SPC-GNG-001", "Ginger", "இஞ்சி"),
        ("crop_taxonomy.SPC-MIX-001", "Mixed Spices", "கலவை மசாலா"),
        ("crop_taxonomy.SPC-NTM-001", "Nutmeg", "ஜாதிக்காய்"),
        ("crop_taxonomy.SPC-PPR-001", "Black Pepper", "மிளகு"),
        ("crop_taxonomy.SPC-TRM-001", "Turmeric", "மஞ்சள்"),
    ]


HDR_FILL = PatternFill("solid", fgColor="1A6B32")
HDR_FONT = Font(color="FFFFFF", bold=True, size=11)
EDIT_FILL = PatternFill("solid", fgColor="FFF4CC")


def style_sheet(ws, ncols=5):
    widths = [34, 52, 52, 52, 30]
    for i, w in enumerate(widths[:ncols], 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    for c in range(1, ncols + 1):
        cell = ws.cell(row=1, column=c)
        cell.fill = HDR_FILL
        cell.font = HDR_FONT
        cell.alignment = Alignment(vertical="center")
    ws.freeze_panes = "A2"


def main():
    en, ta = load("en.json"), load("ta.json")
    staged = staged_keys()

    already = set()
    if os.path.exists(INVENTORY):
        already = set(json.load(io.open(INVENTORY, encoding="utf-8")).get("already_translated", []))

    wb = Workbook()

    # ---- guidance sheet ----
    ws = wb.active
    ws.title = "READ ME FIRST"
    guidance = [
        ("GoviHub — Tamil review pack", ""),
        ("", ""),
        ("What to do", "Fill in the Correction column ONLY where the Tamil is wrong, awkward, "
                       "or not what a Sri Lankan Tamil speaker would actually say. Leave it blank "
                       "if the current text is fine. Blank means 'approved'."),
        ("Dialect", "Sri Lankan Tamil, not Indian Tamil. Where the two differ use the Sri Lankan "
                    "form — இலக்கம் rather than எண் for 'number' is the kind of choice we want."),
        ("Register", "The users are farmers, buyers and suppliers in Anuradhapura and Polonnaruwa. "
                     "Natural spoken Tamil beats formal written Tamil."),
        ("Length", "These are buttons and labels on a phone screen. Shorter is better. If a "
                   "correct translation is very long, give the shortest natural form."),
        ("Curly braces", "Text like {count} or {district} is a placeholder the app fills in. Keep "
                         "every placeholder exactly as it appears, spelled the same, or the screen "
                         "will break. You may move it within the sentence."),
        ("Do not translate", "GoviHub, WhatsApp, SMS, LKR, kg. These stay as they are."),
        ("Status column", "'new draft' = machine translated in this batch, never reviewed. "
                          "'already live' = has been in front of users, still never reviewed. "
                          "'previously staged' = was queued in the old review file. "
                          "Treat all three the same: correct anything that is wrong."),
        ("Crop names", "The CROP NAMES sheet holds names stored in the database, not the app text "
                       "file. They are corrected the same way."),
        ("", ""),
        ("When finished", "Send the file back unchanged apart from the Correction column. "
                          "The corrections are applied by script; nothing needs retyping."),
    ]
    ws.append(["Topic", "Detail"])
    for a, b in guidance:
        ws.append([a, b])
    ws.column_dimensions["A"].width = 22
    ws.column_dimensions["B"].width = 108
    for r in range(2, ws.max_row + 1):
        ws.cell(row=r, column=2).alignment = Alignment(wrap_text=True, vertical="top")
        ws.cell(row=r, column=1).font = Font(bold=True)
    style_sheet(ws, 2)

    # ---- one sheet per module ----
    by_mod = {}
    for k in en:
        by_mod.setdefault(k.split(".")[0], []).append(k)

    counts = {"new draft": 0, "already live": 0, "previously staged": 0}
    for mod in sorted(by_mod, key=lambda m: -len(by_mod[m])):
        keys = by_mod[mod]
        title = mod[:28] or "root"
        ws = wb.create_sheet(title=title)
        ws.append(["Key", "English", "Tamil (current)", "Correction (leave blank if fine)", "Status"])
        for k in keys:
            ev, tv = en.get(k, ""), ta.get(k, "")
            if not isinstance(ev, str) or not ev.strip():
                continue
            if k in staged:
                status = "previously staged"
            elif k in already:
                status = "already live"
            else:
                status = "new draft"
            counts[status] = counts.get(status, 0) + 1
            ws.append([k, ev, tv if isinstance(tv, str) else "", "", status])
        style_sheet(ws)
        for r in range(2, ws.max_row + 1):
            ws.cell(row=r, column=3).font = Font(name=TAMIL_FONT, size=11)
            ws.cell(row=r, column=4).font = Font(name=TAMIL_FONT, size=11)
            ws.cell(row=r, column=4).fill = EDIT_FILL
            for c in (2, 3, 4):
                ws.cell(row=r, column=c).alignment = Alignment(wrap_text=True, vertical="top")
        ws.cell(row=1, column=1).comment = None

    # ---- crop names from the database ----
    ws = wb.create_sheet(title="CROP NAMES")
    ws.append(["Key", "English", "Tamil (current)", "Correction (leave blank if fine)", "Status"])
    for code, e, t in crop_names():
        ws.append([code, e, t, "", "already live (database)"])
    style_sheet(ws)
    for r in range(2, ws.max_row + 1):
        ws.cell(row=r, column=3).font = Font(name=TAMIL_FONT, size=11)
        ws.cell(row=r, column=4).font = Font(name=TAMIL_FONT, size=11)
        ws.cell(row=r, column=4).fill = EDIT_FILL

    wb.save(OUT)

    total = sum(counts.values())
    print("written: %s" % OUT)
    print("sheets : %d  (1 guidance + %d modules + 1 crop names)" % (len(wb.sheetnames), len(by_mod)))
    print("rows   : %d locale strings + %d crop names" % (total, len(crop_names())))
    for k, v in sorted(counts.items(), key=lambda x: -x[1]):
        print("   %-20s %d" % (k, v))
    print("staged keys folded in from TAMIL_REVIEW_PENDING.md: %d" % len(staged))
    return 0


if __name__ == "__main__":
    sys.exit(main())
