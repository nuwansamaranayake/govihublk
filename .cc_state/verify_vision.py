"""Extract the four canonical strings from each modified page source and diff
against .cc_state/vision_canonical.txt. Zero diff required."""
import os, re, sys, html, difflib

ROOT = r"E:\AiGNITE\projects\GoviHub"
CANON = os.path.join(ROOT, ".cc_state", "vision_canonical.txt")
canon = open(CANON, encoding="utf-8").read().rstrip("\n").split("\n")
assert len(canon) == 4, len(canon)

targets = {
    "govihub-umbrella/public/index.html": "html",
    "govihub-umbrella/public/si.html": "html",
    "govihub-web/src/app/[locale]/page.tsx": "tsx",
}

fail = 0
for rel, kind in targets.items():
    p = os.path.join(ROOT, *rel.split("/"))
    t = open(p, encoding="utf-8").read()
    if kind == "html":
        found = re.findall(r'<p class="vm-(?:si|en)">(.*?)</p>', t, re.S)
        # unescape in case any entity escaping crept in
        found = [html.unescape(x) for x in found]
    else:
        # page.tsx imports the constants; resolve them from src/lib/visionMission.ts
        lib = open(os.path.join(ROOT, "govihub-web", "src", "lib", "visionMission.ts"),
                   encoding="utf-8").read()
        names = ["VISION_SI", "VISION_EN", "MISSION_SI", "MISSION_EN"]
        for n in names:
            assert re.search(r"\{[^}]*\b%s\b[^}]*\}\s*from\s*\"@/lib/visionMission\"" % n, t, re.S), \
                "%s not imported by page.tsx" % n
            assert "{%s}" % n in t, "%s not rendered in page.tsx" % n
        found = [re.search(r'export const %s\s*=\s*\n?\s*"(.*?)";' % n, lib, re.S).group(1)
                 for n in names]
    # canonical order: vision_si, vision_en, mission_si, mission_en
    order = [canon[0], canon[1], canon[2], canon[3]]
    print("=== %s : extracted %d strings" % (rel, len(found)))
    if found != order:
        fail = 1
        for a, b in zip(order, found + [""] * 4):
            if a != b:
                print("  MISMATCH")
                for line in difflib.unified_diff([a], [b], "canonical", rel, lineterm=""):
                    print("   ", line)
    else:
        print("  ZERO DIFF (4/4 byte-identical, incl. U+200D ZWJ)")

sys.exit(fail)
