# RESEND_VERIFICATION.md

**Date:** 2026-04-18
**Status:** ✅ READY FOR DAILY AUTOMATION UPGRADE

---

## Summary

The new `send_admin_email` MCP tool is live on `spices.govihublk.com`, backed by Resend. Two real emails were sent to `govihub.ai@gmail.com` and Resend's API confirms `last_event: delivered` for both. Reuses AiGNITE Consulting's existing Resend account; the new scoped key `govihub-spices-prod` (sending permission only) is in the VPS env file. No real key was committed.

## Pre-existing email infra

None. SendGrid scaffolding was added in commit `f6804b7` and immediately replaced by this Resend implementation in commit `36e5800`. Before that, the API had no email sender of any kind — only `twilio` (SMS) and `firebase-admin` (FCM).

## Resend SDK

- **Package:** `resend==2.4.0`
- **Verified in container:** `docker exec govihub-spices-govihub-api-spices-1 python -c "import resend"` → no error.
- **Replaced:** `sendgrid==6.11.0` (uninstalled in the image rebuild).

## VPS env vars

Set in `/opt/govihub-spices/.env.spices` (real values redacted):

```
RESEND_API_KEY=re_***REDACTED***
RESEND_FROM_EMAIL=reports@govihublk.com
RESEND_FROM_NAME=GoviHub Reports
ADMIN_REPORT_RECIPIENTS=govihub.ai@gmail.com
```

Backup of pre-Resend env at `~/backups/.env.spices.pre-resend-<timestamp>` on the VPS.

## MCP tool registration

In-container Python check on `app.mcp.tools`:

| Field | Value |
|---|---|
| `len(TOOL_DEFINITIONS)` | **19** |
| `"send_admin_email" in TOOL_DEFINITIONS names` | True |
| `"send_admin_email" in TOOL_HANDLERS` | True |
| Description mentions Resend | True |
| `reply_to` in input schema | True |
| Required fields | `subject`, `html_body` |

## Smoke test

Invoked `_handle_send_admin_email` twice in-process inside the API container (the same handler the MCP `/mcp/messages/{session_id}` dispatcher invokes):

| # | Subject | Resend message_id | Tool return | Resend `last_event` |
|---|---|---|---|---|
| 1 | `GoviHub Resend smoke test` | `3706308c-b60a-4ab6-8f82-5313fe189008` | `{sent: true, recipient_count: 1}` | **delivered** |
| 2 | `GoviHub Resend smoke test (2)` | `2b31b9f6-d9f4-4f80-9b67-a2913c3d1c27` | `{sent: true, recipient_count: 1}` | **delivered** |

Resend `Emails.get(...)` confirmed both emails:
- `to: ["govihub.ai@gmail.com"]`
- `from: "GoviHub Reports <reports@govihublk.com>"`
- `last_event: delivered`
- `created_at: 2026-04-18 05:18:31 UTC` (sequential, ~250 ms apart)

## Caveats and follow-ups

1. **Inbox vs Spam check is on Nuwan.** Resend reports `delivered` (the receiving MTA accepted the message) but Gmail can still bin it as Spam after delivery. Open `govihub.ai@gmail.com`, search for `GoviHub Resend smoke test`, confirm both messages are in Inbox.
2. **MCP transport not exercised end-to-end yet.** I called the handler in-process (not via `/mcp/messages/{session_id}` over SSE) because the registered Claude.ai connector cache pre-dates the new tool — `ToolSearch` doesn't list `send_admin_email` yet. The in-process call exercises the actual handler, EmailService, Resend SDK, DNS path, and Resend API — strictly more than a `curl` test would. The remaining MCP transport layer (SSE handshake + bearer-token auth + JSON-RPC envelope) is the same code path that the other 18 tools use successfully every day. **Per CLAUDE.md MCP rule, Nuwan should also hit the tool once from a real Claude client (Claude.ai or Claude Desktop) once the connector cache refreshes**, before declaring the daily automation upgrade fully verified.
3. **Domain verification.** `reports@govihublk.com` resolved to `delivered` on the first try, so the `govihublk.com` SPF/DKIM records on Resend are clearly already in place. No follow-up needed there.
4. **No `reply_to` set today.** If Nuwan wants admin replies routed to `support@govihublk.com` (instead of `reports@govihublk.com`), the daily automation can pass `reply_to: "support@govihublk.com"` per call — schema supports it.

## Daily automation upgrade

`daily_report_automation_v2.md` is in the repo with the verbatim Claude instruction. No code change needed — Nuwan flips the existing automation step from `Gmail:create_draft` to `Spices GoviHub Admin:send_admin_email` and runs it manually once. If green, the 07:00 SL daily schedule starts auto-delivering tomorrow.

## Git

| Commit | Branch | Description |
|---|---|---|
| `f6804b7` | `beta-auth` | feat(email): SendGrid email service + send_admin_email MCP tool (superseded) |
| `36e5800` | `beta-auth` | feat(email): switch from SendGrid to Resend (reuse AiGNITE Resend account) |

Both pushed to `origin/beta-auth`. No `.env.spices` or real API key was staged.

## Flags

- None blocking. See caveats #1 and #2 above for the two manual confirmations Nuwan should do before sleep.

## One-line summary

**READY FOR DAILY AUTOMATION UPGRADE.**
