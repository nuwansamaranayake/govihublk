"""
Translate help content JSON from English to Sinhala using Gemini via OpenRouter.
Preserves JSON structure, translates only string values.

Usage:
  python scripts/translate_help.py --api-key YOUR_OPENROUTER_KEY
"""

import json
import os
import sys
import argparse
import requests
import time

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "google/gemini-2.0-flash-001"

SYSTEM_PROMPT = """You are translating help content for GoviHub (ගොවිHub), a farming app for Sri Lankan farmers.

RULES:
1. Use simple spoken Sinhala (කථිත සිංහල) — NOT formal/literary
2. Sound like a helpful friend explaining the app, not a manual
3. Keep it short — mobile screens have limited space
4. Use agricultural terms farmers actually use:
   - Harvest = අස්වැන්න
   - Listing = ලැයිස්තුව
   - Match = ගැළපීම
   - Demand = ඉල්ලුම
   - Marketplace = වෙළඳපොළ
   - Dashboard = මුල් පිටුව
   - Diagnosis = රෝග හඳුනාගැනීම
   - Advisory = උපදේශන
5. Keep brand names (GoviHub), units (kg, km), and technical terms (GPS) in English
6. Translate ONLY the text values — preserve all JSON keys in English

Return ONLY valid JSON — no markdown, no explanation."""


def translate_batch(texts: list[str], api_key: str) -> list[str]:
    """Translate a batch of strings."""
    prompt = f"Translate these English strings to Sinhala. Return a JSON array of translated strings in the SAME order:\n\n{json.dumps(texts, ensure_ascii=False)}"

    resp = requests.post(
        OPENROUTER_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": MODEL,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.3,
        },
        timeout=60,
    )
    resp.raise_for_status()
    content = resp.json()["choices"][0]["message"]["content"]

    # Strip markdown code fences if present
    content = content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1] if "\n" in content else content[3:]
    if content.endswith("```"):
        content = content[:-3]
    content = content.strip()

    return json.loads(content)


def collect_strings(obj, path=""):
    """Collect all string values from nested dict/list with their paths."""
    strings = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            strings.extend(collect_strings(v, f"{path}.{k}" if path else k))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            strings.extend(collect_strings(v, f"{path}[{i}]"))
    elif isinstance(obj, str):
        strings.append((path, obj))
    return strings


def set_by_path(obj, path, value):
    """Set a value in a nested dict/list by dot-bracket path."""
    parts = []
    current = ""
    for ch in path:
        if ch == ".":
            if current:
                parts.append(current)
            current = ""
        elif ch == "[":
            if current:
                parts.append(current)
            current = ""
        elif ch == "]":
            parts.append(int(current))
            current = ""
        else:
            current += ch
    if current:
        parts.append(current)

    ref = obj
    for i, part in enumerate(parts[:-1]):
        ref = ref[part]
    ref[parts[-1]] = value


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--api-key", required=True)
    parser.add_argument("--source", default="govihub-web/public/help/en.json")
    parser.add_argument("--output", default="govihub-web/public/help/si.json")
    parser.add_argument("--batch-size", type=int, default=20)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    with open(args.source, "r", encoding="utf-8") as f:
        en_data = json.load(f)

    # Deep copy for output
    si_data = json.loads(json.dumps(en_data))

    # Collect all strings
    all_strings = collect_strings(en_data)
    print(f"Found {len(all_strings)} strings to translate")

    if args.dry_run:
        for path, text in all_strings[:10]:
            print(f"  {path}: {text[:60]}...")
        return

    # Translate in batches
    translated = 0
    for i in range(0, len(all_strings), args.batch_size):
        batch = all_strings[i : i + args.batch_size]
        texts = [t for _, t in batch]
        paths = [p for p, _ in batch]

        print(f"Translating batch {i // args.batch_size + 1} ({len(batch)} strings)...")

        try:
            results = translate_batch(texts, args.api_key)
            for path, translation in zip(paths, results):
                set_by_path(si_data, path, translation)
                translated += 1
        except Exception as e:
            print(f"  ERROR: {e}")
            # Keep English fallback for failed batches
            continue

        time.sleep(1)  # Rate limit

    # Write output
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(si_data, f, ensure_ascii=False, indent=2)

    print(f"\nDone: {translated}/{len(all_strings)} strings translated")
    print(f"Output: {args.output}")


if __name__ == "__main__":
    main()
