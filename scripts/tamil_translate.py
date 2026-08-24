"""P2: translate the missing/untranslated Tamil keys via the gemini-translate skill.

Chunked, idempotent, resumable. A rerun recomputes the work set from the current
ta.json, so keys that already pass the gates are never retranslated and a handoff
mid-run costs at most one chunk.

Progress is appended to tamil_translate_progress.json after every chunk.

  python scripts/tamil_translate.py --chunks 1     # time a single chunk
  python scripts/tamil_translate.py                # run to completion
"""
import argparse
import io
import json
import os
import re
import subprocess
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MSG = os.path.join(ROOT, "govihub-web", "src", "messages")
PROGRESS = os.path.join(ROOT, "tamil_translate_progress.json")

SKILL = os.environ.get("GEMINI_TRANSLATE_SKILL") or os.path.join(
    os.environ.get("APPDATA", ""), "Claude", "local-agent-mode-sessions", "skills-plugin",
    "4a365ec5-dfa5-4c85-a366-8a3de28e3f26", "173f21be-ad7f-485f-9076-65d5774ffc84",
    "skills", "gemini-translate")
TRANSLATE = os.path.join(SKILL, "scripts", "translate.py")

TOKEN = re.compile(r"\{([a-zA-Z0-9_]+)\}")
TAMIL = re.compile(r"[஀-௿]")

# Module -> what the screen actually is, so the model gets real context.
MODULE_CONTEXT = {
    "common": "shared buttons and labels across the app",
    "auth": "registration and login screens",
    "home": "landing page",
    "farmer": "farmer dashboard: harvest listings, prices, matches",
    "buyer": "buyer dashboard: browsing harvests and contacting farmers",
    "supplier": "supplier dashboard: selling seeds, fertiliser and equipment",
    "marketplace": "marketplace for farm supplies",
    "diagnosis": "AI crop disease diagnosis from a leaf photo",
    "weather": "weather forecast and rainfall alerts",
    "matches": "automatic buyer-to-farmer matching results",
    "alerts": "notifications and warnings",
    "ads": "advertisements shown to farmers",
    "crops": "spice crop names and growing information",
    "settings": "account settings",
    "tos": "terms of use and legal text",
    "roles": "user role names (farmer, buyer, supplier)",
}
BASE_CONTEXT = ("agricultural marketplace mobile app for Sri Lankan spice farmers, "
                "natural spoken Sri Lankan Tamil, not literary or Indian Tamil, "
                "short UI labels")


def flatten(obj, prefix=""):
    out = {}
    for k, v in obj.items():
        key = prefix + "." + k if prefix else k
        if isinstance(v, dict):
            out.update(flatten(v, key))
        else:
            out[key] = v
    return out


def unflatten(flat):
    root = {}
    for k, v in flat.items():
        parts = k.split(".")
        node = root
        for p in parts[:-1]:
            node = node.setdefault(p, {})
        node[parts[-1]] = v
    return root


def load(name):
    with io.open(os.path.join(MSG, name), encoding="utf-8") as f:
        return json.load(f)


def work_set(en_flat, ta_flat):
    """Keys still needing translation. Recomputed every run -> idempotent."""
    need = []
    for k, ev in en_flat.items():
        if not isinstance(ev, str) or not ev.strip():
            continue
        tv = ta_flat.get(k)
        if tv is None or not isinstance(tv, str) or not tv.strip():
            need.append(k)
        elif not TAMIL.search(tv):
            need.append(k)
    return need


def call_skill(pairs, context, provider):
    """pairs: {key: english}. Returns {key: tamil}."""
    tmp = tempfile.mkdtemp(prefix="tamil_")
    src = os.path.join(tmp, "en.json")
    with io.open(src, "w", encoding="utf-8") as f:
        json.dump(unflatten(pairs), f, ensure_ascii=False, indent=1)

    env = dict(os.environ, PYTHONIOENCODING="utf-8", PYTHONUTF8="1")
    cmd = [sys.executable, TRANSLATE, "--input", src, "--output-dir", tmp,
           "--lang", "ta", "--format", "json",
           "--context", context, "--formality", "formal",
           "--provider", provider]
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8",
                       env=env, timeout=900)
    out = os.path.join(tmp, "ta.json")
    if not os.path.exists(out):
        sys.stderr.write("  skill produced no ta.json\n  stderr: %s\n" % (r.stderr or "")[-400:])
        return {}
    with io.open(out, encoding="utf-8") as f:
        return flatten(json.load(f))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--chunk-size", type=int, default=40)
    ap.add_argument("--chunks", type=int, default=0, help="0 = all")
    ap.add_argument("--provider", default="gemini", choices=["gemini", "luna", "both"])
    args = ap.parse_args()

    en_flat = flatten(load("en.json"))
    ta_nested = load("ta.json")
    ta_flat = flatten(ta_nested)

    need = work_set(en_flat, ta_flat)
    print("keys still needing Tamil: %d" % len(need))
    if not need:
        print("nothing to do - already complete")
        return 0

    # group by module so each call carries coherent context
    by_mod = {}
    for k in need:
        by_mod.setdefault(k.split(".")[0], []).append(k)

    chunks = []
    for mod, keys in sorted(by_mod.items(), key=lambda x: -len(x[1])):
        for i in range(0, len(keys), args.chunk_size):
            chunks.append((mod, keys[i:i + args.chunk_size]))
    if args.chunks:
        chunks = chunks[:args.chunks]

    print("chunks to run: %d (chunk size %d, provider %s)\n" % (len(chunks), args.chunk_size, args.provider))

    progress = {"runs": []}
    if os.path.exists(PROGRESS):
        try:
            progress = json.load(io.open(PROGRESS, encoding="utf-8"))
        except Exception:
            pass

    total_added = 0
    t_start = time.time()
    for idx, (mod, keys) in enumerate(chunks, 1):
        ctx = "%s. Screen: %s" % (BASE_CONTEXT, MODULE_CONTEXT.get(mod, mod))
        pairs = {k: en_flat[k] for k in keys}
        t0 = time.time()
        got = call_skill(pairs, ctx, args.provider)
        dt = time.time() - t0

        added, tok_bad = 0, []
        for k in keys:
            v = got.get(k)
            if not isinstance(v, str) or not v.strip() or not TAMIL.search(v):
                continue
            if sorted(set(TOKEN.findall(en_flat[k]))) != sorted(set(TOKEN.findall(v))):
                tok_bad.append(k)
                continue
            ta_flat[k] = v
            added += 1

        # write after EVERY chunk so a kill costs one chunk, not the run
        merged = {k: ta_flat[k] for k in en_flat if k in ta_flat}
        for k in ta_flat:
            if k not in merged:
                merged[k] = ta_flat[k]
        with io.open(os.path.join(MSG, "ta.json"), "w", encoding="utf-8") as f:
            json.dump(unflatten(merged), f, ensure_ascii=False, indent=2)
            f.write("\n")

        total_added += added
        progress["runs"].append({"module": mod, "requested": len(keys), "accepted": added,
                                 "token_mismatch": tok_bad, "seconds": round(dt, 1)})
        with io.open(PROGRESS, "w", encoding="utf-8") as f:
            json.dump(progress, f, ensure_ascii=False, indent=1)

        print("  [%2d/%2d] %-12s %3d requested -> %3d accepted%s  %5.1fs"
              % (idx, len(chunks), mod, len(keys), added,
                 ("  TOKENFAIL:%d" % len(tok_bad)) if tok_bad else "", dt))

    print("\naccepted this run: %d in %.1fs" % (total_added, time.time() - t_start))
    remaining = work_set(en_flat, flatten(load("ta.json")))
    print("keys still needing Tamil: %d" % len(remaining))
    return 0


if __name__ == "__main__":
    sys.exit(main())
