"""P1 measure: inventory Tamil locale coverage against English.

Writes tamil_inventory.json. Prints a summary only — the detail stays in the file.
No prior counts are trusted; everything here is measured.
"""
import io
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MSG = os.path.join(ROOT, "govihub-web", "src", "messages")
OUT = os.path.join(ROOT, "tamil_inventory.json")

# Brand / proper nouns that are legitimately identical in every locale.
WHITELIST = {
    "GoviHub", "govihub", "GoviHubLk", "govihublk.com", "WhatsApp", "SMS", "OK",
    "Email", "email", "AI", "PDPA", "ID", "URL", "%", "LKR", "Rs", "Rs.", "kg", "km",
    "07X XXX XXXX",  # phone format mask - si.json keeps it identical too
}

TOKEN = re.compile(r"\{([a-zA-Z0-9_]+)\}")
# Tamil Unicode block
TAMIL = re.compile(r"[஀-௿]")


def flatten(obj, prefix=""):
    """messages files are nested namespaces; flatten to dotted keys."""
    out = {}
    for k, v in obj.items():
        key = prefix + "." + k if prefix else k
        if isinstance(v, dict):
            out.update(flatten(v, key))
        else:
            out[key] = v
    return out


def load(name):
    p = os.path.join(MSG, name)
    with io.open(p, encoding="utf-8") as f:
        return flatten(json.load(f))


def main():
    en = load("en.json")
    ta = load("ta.json")
    si = load("si.json")

    missing = sorted(k for k in en if k not in ta)
    extra = sorted(k for k in ta if k not in en)

    placeholder = []   # ta value identical to en, not whitelisted
    whitelisted = []   # identical but legitimately so
    translated = []    # real Tamil present
    no_tamil = []      # present, differs from en, but contains no Tamil codepoints

    for k in sorted(en):
        if k not in ta:
            continue
        ev, tv = en[k], ta[k]
        if not isinstance(ev, str) or not isinstance(tv, str):
            continue
        if ev == tv:
            (whitelisted if ev.strip() in WHITELIST or not ev.strip() else placeholder).append(k)
        elif TAMIL.search(tv):
            translated.append(k)
        else:
            no_tamil.append(k)

    # interpolation parity
    interp = {}
    mismatch = []
    for k, ev in en.items():
        if not isinstance(ev, str):
            continue
        toks = sorted(set(TOKEN.findall(ev)))
        if toks:
            interp[k] = toks
            tv = ta.get(k)
            if isinstance(tv, str) and sorted(set(TOKEN.findall(tv))) != toks:
                mismatch.append({"key": k, "en": toks, "ta": sorted(set(TOKEN.findall(tv)))})

    # module = top-level namespace
    def module(k):
        return k.split(".")[0]

    needs = missing + placeholder + no_tamil
    by_module = {}
    for k in needs:
        by_module.setdefault(module(k), 0)
        by_module[module(k)] += 1

    inv = {
        "measured_at_keys": {
            "en_total": len(en),
            "ta_total": len(ta),
            "si_total": len(si),
        },
        "missing_from_ta": missing,
        "extra_in_ta": extra,
        "placeholder_equals_en": placeholder,
        "whitelisted_equals_en": whitelisted,
        "present_but_no_tamil_codepoints": no_tamil,
        "already_translated": translated,
        "interpolation_map": interp,
        "interpolation_mismatches": mismatch,
        "work_items_by_module": dict(sorted(by_module.items(), key=lambda x: -x[1])),
        "total_needing_work": len(needs),
        "whitelist_used": sorted(WHITELIST),
    }

    with io.open(OUT, "w", encoding="utf-8") as f:
        json.dump(inv, f, ensure_ascii=False, indent=1)

    print("en keys                    : %d" % len(en))
    print("ta keys                    : %d" % len(ta))
    print("si keys                    : %d" % len(si))
    print("-" * 46)
    print("missing from ta            : %d" % len(missing))
    print("placeholder (ta == en)     : %d" % len(placeholder))
    print("present but no Tamil chars : %d" % len(no_tamil))
    print("already real Tamil (keep)  : %d" % len(translated))
    print("whitelisted identical      : %d" % len(whitelisted))
    print("extra in ta (not in en)    : %d" % len(extra))
    print("interpolation mismatches   : %d" % len(mismatch))
    print("-" * 46)
    print("TOTAL NEEDING WORK         : %d  of %d  (%.1f%% coverage today)"
          % (len(needs), len(en), 100.0 * len(translated) / len(en) if en else 0))
    print()
    print("top modules needing work:")
    for m, n in list(inv["work_items_by_module"].items())[:12]:
        print("  %-28s %d" % (m, n))
    print()
    print("written: %s" % OUT)


if __name__ == "__main__":
    main()
