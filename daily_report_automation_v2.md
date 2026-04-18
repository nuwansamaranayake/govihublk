# GoviHub Spices — Daily Report Automation v2

**Status:** v2 supersedes the v1 Gmail-draft flow.
**Effective:** after the Part 7 smoke test in CC_RESEND_EMAIL_TOOL.md passes.
**Provider:** Resend (reusing AiGNITE Consulting's account with a scoped `govihub-spices-prod` API key).

## What changed vs v1

| | v1 (old) | v2 (new) |
|---|---|---|
| Delivery | `Gmail:create_draft` — Nuwan had to open Gmail and click Send | `Spices GoviHub Admin:send_admin_email` — autonomous, no human in the loop |
| Recipients | one address in the draft body | `ADMIN_REPORT_RECIPIENTS` env var (comma-separated) |
| Body | HTML embedded in the draft | HTML passed directly to the tool |
| Evidence | a draft ID | `message_id` and `recipient_count` from Resend |
| Failure mode | Silent — the draft sits in Gmail unsent | Loud — tool raises, Claude sees the error, reports it in the reply |

## The updated Claude automation instruction

Replace the old step that called `Gmail:create_draft` with this verbatim:

> **Step 4. Send the report**
>
> Use `Spices GoviHub Admin:send_admin_email` with:
>
> - `subject`: `GoviHub Spices — Daily Report — {{formatted_date_sl}}`
>   (e.g. `GoviHub Spices — Daily Report — 2026-04-19 (Sun)`)
> - `html_body`: the full HTML assembled in Step 3
> - Omit `to` — the tool will default to `ADMIN_REPORT_RECIPIENTS` from the VPS env file.
> - Omit `reply_to` unless you want replies routed to a specific human inbox (e.g. `support@govihublk.com`).
>
> Do NOT pass `cc` or `bcc` unless Nuwan explicitly adds recipients for a given run.
>
> **Step 5. Reply**
>
> The tool returns `{message_id, recipient_count}`. Reply with one line:
>
> `Daily report emailed to {{recipient_count}} admin(s) at {{timestamp_sl}}. Resend message_id: {{message_id}}`
>
> If the tool raises, reply with:
>
> `FAILED to send daily report — Resend error: {{error_message}}. Check the Resend dashboard and the VPS env file.`

## Recipient list management

Recipients are read from the `ADMIN_REPORT_RECIPIENTS` env var on the VPS (comma-separated).

To add Gamini or Aruni later:

```bash
# on VPS
nano /opt/govihub-spices/.env.spices
# edit: ADMIN_REPORT_RECIPIENTS=govihub.ai@gmail.com,gamini@example.com,aruni@example.com
docker compose -f /opt/govihub-spices/docker-compose.spices.yml restart govihub-api-spices
```

No code change required.

## Deliverability checks (Nuwan's one-time setup)

When the Resend API key was provisioned, one of these two paths was chosen:

- **Path A — Domain verification for `govihublk.com` in Resend.** SPF and DKIM (and optionally DMARC) DNS records added at the registrar. `RESEND_FROM_EMAIL` can be anything `@govihublk.com`. Highest deliverability. Recommended.
- **Path B — Single-sender verified address.** Works immediately but deliverability is weaker for transactional sends and the from-address is locked to one mailbox.

If Path B is in use at launch, schedule a follow-up to migrate to Path A — `ADMIN_REPORT_RECIPIENTS` defaults to `govihub.ai@gmail.com`, and Gmail's spam filter is the hard gate.

## Rollback

If v2 misfires before Nuwan can debug:

1. Flip the automation back to `Gmail:create_draft` in one edit.
2. No code rollback needed — `send_admin_email` stays registered, just unused.
3. Investigate the Resend dashboard at https://resend.com/emails, check VPS logs:
   ```bash
   ssh govihub-mumbai docker logs govihub-spices-govihub-api-spices-1 --tail 100 | grep -iE 'resend|email'
   ```

## Schedule

Existing cron stays: **07:00 Asia/Colombo** daily. v2 is transparent to the scheduler.
