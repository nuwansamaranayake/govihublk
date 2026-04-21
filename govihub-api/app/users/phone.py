"""Shared E.164 phone-number validation for GoviHub.

E.164 format: leading '+', country code (1-9), up to 14 more digits.
Example: +94771234567 (Sri Lanka), +14155552671 (US).
"""

import re

E164_PATTERN = re.compile(r"^\+[1-9]\d{1,14}$")

_E164_ERROR_MSG = (
    "Phone must be in international E.164 format, starting with '+' "
    "and country code, e.g. +94771234567"
)


def normalize_phone(v: str) -> str:
    return v.strip().replace(" ", "").replace("-", "")


def validate_e164_phone(v: str) -> str:
    """Validate a non-empty phone string; raise ValueError on failure."""
    cleaned = normalize_phone(v)
    if not E164_PATTERN.match(cleaned):
        raise ValueError(_E164_ERROR_MSG)
    return cleaned


def validate_e164_phone_optional(v):
    """Validate optional phone; allow None/empty to pass through."""
    if v is None or v == "":
        return v
    return validate_e164_phone(v)
