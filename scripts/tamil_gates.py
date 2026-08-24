"""GT.1-GT.4 gate checker for the Tamil locale file.

Exits 0 only if every gate passes. Used after translation and again after the
reviewer's corrections are applied.

  python scripts/tamil_gates.py
"""
import io
import json
import os
import random
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MSG = os.path.join(ROOT, "govihub-web", "src", "messages")

# Brand and unit tokens that are correctly identical across locales.
WHITELIST = {
    "GoviHub", "govihub", "GoviHubLk", "govihublk.com", "WhatsApp", "SMS", "OK",
    "Email", "email", "AI", "PDPA", "ID", "URL", "%", "LKR", "Rs", "Rs.", "kg", "km",
    "07X XXX XXXX",  # phone format mask - si.json keeps it identical too
}
TOKEN = re.compile(r"\{([a-zA-Z0-9_]+)\}")
TAMIL = re.compile(r"[஀-௿]")


def flatten(obj, prefix=""):
    out = {}
    for k, v in obj.items():
        key = prefix + "." + k if prefix else k
        if isinstance(v, dict):
            out.update(flatten(v, key))
        else:
            out[key] = v
    return out


def main():
    results = []

    # GT.4a - file parses
    try:
        with io.open(os.path.join(MSG, "ta.json"), encoding="utf-8") as f:
            ta_nested = json.load(f)
        parse_ok = True
    except Exception as exc:
        print("GT.4  FAIL - ta.json does not parse: %s" % exc)
        return 1

    en = flatten(json.load(io.open(os.path.join(MSG, "en.json"), encoding="utf-8")))
    ta = flatten(ta_nested)

    # GT.1 key parity
    missing = sorted(k for k in en if k not in ta)
    ok1 = not missing
    results.append(ok1)
    print("GT.1  key parity                : %s  (%d missing)" % ("PASS" if ok1 else "FAIL", len(missing)))
    for k in missing[:8]:
        print("        missing: %s" % k)

    # GT.2 interpolation parity
    mism = []
    for k, ev in en.items():
        if not isinstance(ev, str):
            continue
        tv = ta.get(k)
        if not isinstance(tv, str):
            continue
        a, b = sorted(set(TOKEN.findall(ev))), sorted(set(TOKEN.findall(tv)))
        if a != b:
            mism.append((k, a, b))
    ok2 = not mism
    results.append(ok2)
    print("GT.2  interpolation parity      : %s  (%d mismatches)" % ("PASS" if ok2 else "FAIL", len(mism)))
    for k, a, b in mism[:8]:
        print("        %s  en=%s ta=%s" % (k, a, b))

    # GT.3 no non-whitelisted ta == en
    same = []
    for k, ev in en.items():
        tv = ta.get(k)
        if isinstance(ev, str) and isinstance(tv, str) and ev == tv and ev.strip():
            if ev.strip() not in WHITELIST:
                same.append(k)
    ok3 = not same
    results.append(ok3)
    print("GT.3  no untranslated leftovers : %s  (%d non-whitelisted ta==en)"
          % ("PASS" if ok3 else "FAIL", len(same)))
    for k in same[:8]:
        print("        %s = %r" % (k, en[k][:50]))

    # GT.4 parses + 20-value sample contains Tamil codepoints
    candidates = [k for k, v in ta.items()
                  if isinstance(v, str) and v.strip() and en.get(k, "").strip() not in WHITELIST]
    random.seed(20260824)
    sample = random.sample(candidates, min(20, len(candidates)))
    no_tamil = [k for k in sample if not TAMIL.search(ta[k])]
    ok4 = parse_ok and not no_tamil
    results.append(ok4)
    print("GT.4  parses + Tamil in sample  : %s  (%d/%d sampled values lack Tamil)"
          % ("PASS" if ok4 else "FAIL", len(no_tamil), len(sample)))
    for k in no_tamil[:8]:
        print("        %s = %r" % (k, ta[k][:50]))

    print("-" * 52)
    print("en keys %d | ta keys %d | with Tamil %d"
          % (len(en), len(ta), sum(1 for v in ta.values() if isinstance(v, str) and TAMIL.search(v))))
    allok = all(results)
    print("RESULT: %s" % ("ALL GATES PASS" if allok else "GATES FAILED"))
    return 0 if allok else 1


if __name__ == "__main__":
    sys.exit(main())
