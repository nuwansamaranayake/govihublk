# RESEND_AUDIT.md

**Date:** 2026-04-18
**Context:** Switching the just-shipped SendGrid plumbing (commit `f6804b7`) over to Resend. Reusing AiGNITE Consulting's existing Resend account with a new scoped API key for GoviHub.

## 1.1 Existing email infrastructure

- **Provider in code right now:** SendGrid (just added in commit `f6804b7`, dormant — no real API key on the VPS yet, container started cleanly with empty config).
- **Provider before that commit:** none. No SMTP, no Mailgun, no email service of any kind. Only `twilio` (SMS) and `firebase-admin` (FCM) were present.
- **Service class location:** `app/utils/email.py` (matches the `app/utils/storage.py` singleton pattern; the plan's `app/services/email_service.py` path doesn't exist in this repo).
- **MCP tool already registered:** `send_admin_email` was added in `app/mcp/tools.py` (`TOOL_DEFINITIONS` + `TOOL_HANDLERS`), 19 tools total.
- **Action:** **Replace** SendGrid in place — do not extend. Same files, same MCP tool name, same handler dispatch entry. Only the SDK, env var names, and return shape change.

## 1.2 Env conventions

- Pydantic settings in `app/config.py` (single `Settings` class loaded from `.env`).
- VPS prod env at `/opt/govihub-spices/.env.spices`, injected via `env_file: .env.spices` in `docker-compose.spices.yml`. No env-passthrough in compose labels — the env file is the single source.
- `.env.example` and `.env.spices.template` are the templates that get committed.

Match: add `RESEND_*` vars to `Settings`, drop the four `SENDGRID_*` vars from the same file, update both templates.

## 1.3 MCP tool registration pattern

- `TOOL_DEFINITIONS: list[dict]` in `govihub-api/app/mcp/tools.py` — JSON-Schema dicts.
- `TOOL_HANDLERS: dict[str, Any]` at file end — `name → async _handle_*` callable.
- Auth is bearer-token shared secret (`MCP_ADMIN_SECRET`) verified by `app/mcp/auth.py:verify_mcp_token` for every `/mcp/*` call. No per-tool RBAC needed; admin role is assumed.

The existing `send_admin_email` tool def + handler stay; description text gets reworded ("SendGrid" → "Resend"), handler return shape loses `status_code` (Resend doesn't provide one), gains `reply_to` parameter pass-through.

## What's getting changed

| File | SendGrid → Resend |
|---|---|
| `govihub-api/requirements.txt` | `sendgrid==6.11.0` → `resend==2.4.0` |
| `govihub-api/app/utils/email.py` | rewrite the `EmailService` body to use `resend.Emails.send` |
| `govihub-api/app/config.py` | `SENDGRID_*` → `RESEND_*` (3 vars) |
| `govihub-api/app/mcp/tools.py` | tool description + handler return-shape (drop `status_code`, accept `reply_to`) |
| `.env.example` | placeholder block swapped |
| `.env.spices.template` | same |
| `daily_report_automation_v2.md` | references "SendGrid" → "Resend" |

## Pre-existing AiGNITE Resend account

Per the plan, Nuwan already runs Resend for AiGNITE. New scoped key `govihub-spices-prod` (sending permission only) will be issued on his side. `govihublk.com` domain verification on Resend is a prerequisite for Path A (`reports@govihublk.com`); without it, Path B = a single-sender verified address.

## Decision

In-place replacement. No backwards-compat. SendGrid SDK uninstalled in the next image rebuild.
