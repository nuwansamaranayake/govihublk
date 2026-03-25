"""
Translate GoviHub UI strings from English to Sinhala using OpenRouter API.
Produces natural, farmer-friendly Sinhala translations.

Usage:
  python scripts/translate_sinhala.py --api-key YOUR_OPENROUTER_KEY
  python scripts/translate_sinhala.py --api-key YOUR_OPENROUTER_KEY --dry-run
  python scripts/translate_sinhala.py --api-key YOUR_OPENROUTER_KEY --force
"""

import json
import os
import sys
import time
import argparse
import requests

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "google/gemini-2.0-flash-001"

SYSTEM_PROMPT = """You are a professional Sinhala translator for a farming application called GoviHub (ගොවිHub).

CONTEXT:
- GoviHub is an AI-powered agricultural marketplace for Sri Lankan farmers
- Users are rural farmers in Anuradhapura and Polonnaruwa (dry zone)
- They have basic smartphone literacy but NO English knowledge
- The app connects farmers with buyers, provides crop disease diagnosis, weather alerts, and market prices

TRANSLATION RULES:
1. Use simple, everyday spoken Sinhala (කථිත සිංහල) — NOT literary/formal Sinhala
2. Use Sinhala words farmers actually use in conversation, not textbook equivalents
3. For technical terms with no natural Sinhala word, keep the English term in Sinhala script: e.g., "Dashboard" → "ඩෑෂ්බෝඩ්"
4. Keep translations SHORT — these appear on mobile UI buttons, labels, and headers
5. Agriculture-specific terms should use the vocabulary farmers in the dry zone actually use:
   - "Harvest" → "අස්වැන්න", "Listing" → "දැන්වීම", "Match" → "ගැළපීම"
   - "Demand" → "ඉල්ලුම", "Supply" → "සැපයුම", "Buyer" → "ගැනුම්කරු"
   - "Supplier" → "සැපයුම්කරු", "Crop" → "බෝගය", "Fertilizer" → "පොහොර"
6. For action buttons: use direct, imperative forms
   - "Save" → "සුරකින්න", "Cancel" → "අවලංගු කරන්න", "Submit" → "යොමු කරන්න"
7. For status labels: use past tense forms where appropriate
   - "Planned" → "සැලසුම් කළ", "Ready" → "සූදානම්", "Fulfilled" → "සම්පූර්ණ කළ"
8. Placeholder text should sound natural: "ඔබේ නම ඇතුළත් කරන්න"
9. Error messages should be gentle and clear, not technical

IMPORTANT: Return ONLY the Sinhala translation. No explanations, no alternatives.
If a value is a brand name or technical identifier (e.g., "GoviHub", "GPS"), return it unchanged."""


def translate_batch(texts: dict, api_key: str) -> dict:
    items = []
    for key, english in texts.items():
        items.append(f'"{key}": "{english}"')

    prompt = f"""Translate the following English UI strings to Sinhala for a farming app.
Return ONLY a valid JSON object with the same keys and Sinhala translations as values.
No markdown, no code blocks, no explanation — just the JSON.

{{
{chr(10).join(items)}
}}"""

    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.3,
        "max_tokens": 8192,
    }

    response = requests.post(
        OPENROUTER_URL,
        json=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "HTTP-Referer": "https://govihublk.com",
            "X-Title": "GoviHub Translation",
        },
        timeout=60
    )
    response.raise_for_status()

    result = response.json()
    text = result["choices"][0]["message"]["content"]

    # Clean up markdown code fences if present
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1]
    if text.endswith("```"):
        text = text.rsplit("\n", 1)[0]
    if text.startswith("json"):
        text = text[4:].strip()

    return json.loads(text)


def flatten_json(obj, prefix=""):
    items = {}
    for k, v in obj.items():
        key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            items.update(flatten_json(v, key))
        else:
            items[key] = v
    return items


def unflatten_json(flat: dict) -> dict:
    result = {}
    for key, value in flat.items():
        parts = key.split(".")
        d = result
        for part in parts[:-1]:
            if part not in d:
                d[part] = {}
            d = d[part]
        d[parts[-1]] = value
    return result


def main():
    parser = argparse.ArgumentParser(description="Translate GoviHub UI to Sinhala via OpenRouter")
    parser.add_argument("--api-key", required=True, help="OpenRouter API key")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing file")
    parser.add_argument("--batch-size", type=int, default=30, help="Strings per API call (default: 30)")
    parser.add_argument("--en-path", default="govihub-web/src/messages/en.json", help="English source file")
    parser.add_argument("--si-path", default="govihub-web/src/messages/si.json", help="Sinhala output file")
    parser.add_argument("--force", action="store_true", help="Re-translate ALL strings, even existing ones")
    args = parser.parse_args()

    with open(args.en_path, "r", encoding="utf-8") as f:
        en_data = json.load(f)

    si_data = {}
    if os.path.exists(args.si_path):
        with open(args.si_path, "r", encoding="utf-8") as f:
            si_data = json.load(f)

    en_flat = flatten_json(en_data)
    si_flat = flatten_json(si_data)

    print(f"\nTranslation Audit:")
    print(f"   English keys:     {len(en_flat)}")
    print(f"   Sinhala keys:     {len(si_flat)}")

    if args.force:
        to_translate = en_flat
        print(f"   Force mode:       re-translating ALL {len(en_flat)} strings")
    else:
        to_translate = {}
        still_english = 0
        for key, en_text in en_flat.items():
            if key not in si_flat:
                to_translate[key] = en_text
            elif si_flat[key] == en_text:
                to_translate[key] = en_text
                still_english += 1
            elif not si_flat[key] or si_flat[key].startswith("["):
                to_translate[key] = en_text

        print(f"   Already translated: {len(en_flat) - len(to_translate)}")
        print(f"   Still in English:   {still_english}")
        print(f"   Missing/empty:      {len(to_translate) - still_english}")
        print(f"   Total to translate: {len(to_translate)}")

    if not to_translate:
        print("\nAll strings already translated. Nothing to do.")
        return

    if args.dry_run:
        print(f"\nDRY RUN — would translate {len(to_translate)} strings:")
        for key, text in list(to_translate.items())[:20]:
            print(f"   {key}: \"{text}\"")
        if len(to_translate) > 20:
            print(f"   ... and {len(to_translate) - 20} more")
        return

    translated = {}
    keys = list(to_translate.keys())
    total_batches = (len(keys) + args.batch_size - 1) // args.batch_size

    print(f"\nTranslating {len(to_translate)} strings in {total_batches} batches (model: {MODEL})...")

    for i in range(0, len(keys), args.batch_size):
        batch_keys = keys[i:i + args.batch_size]
        batch = {k: to_translate[k] for k in batch_keys}
        batch_num = i // args.batch_size + 1

        print(f"   Batch {batch_num}/{total_batches} ({len(batch)} strings)...", end=" ", flush=True)

        try:
            result = translate_batch(batch, args.api_key)
            translated.update(result)
            print(f"OK ({len(result)} translated)")
        except Exception as e:
            print(f"Error: {e}")
            print(f"   Retrying in 5 seconds...")
            time.sleep(5)
            try:
                result = translate_batch(batch, args.api_key)
                translated.update(result)
                print(f"   Retry OK ({len(result)} translated)")
            except Exception as e2:
                print(f"   Retry failed: {e2}")
                print(f"   Skipping batch.")

        if batch_num < total_batches:
            time.sleep(2)

    merged_flat = {**si_flat, **translated}
    for key in si_flat:
        if key not in merged_flat:
            merged_flat[key] = si_flat[key]

    merged = unflatten_json(merged_flat)

    with open(args.si_path, "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)

    print(f"\nDone! Translated {len(translated)}/{len(to_translate)} strings")
    print(f"   Output: {args.si_path}")
    print(f"   Total Sinhala keys: {len(merged_flat)}")

    print(f"\nSample translations:")
    for key, si_text in list(translated.items())[:10]:
        en_text = to_translate.get(key, "")
        print(f"   {key}")
        print(f"     EN: {en_text}")
        print(f"     SI: {si_text}")
        print()


if __name__ == "__main__":
    main()
