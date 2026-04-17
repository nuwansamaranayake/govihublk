# GoviHub Spices — Daily Report Automation v2

**Status:** v2 supersedes the v1 Gmail-draft flow.
**Effective:** after the Part 7 smoke test in CC_SENDGRID_EMAIL_TOOL.md passes.

## What changed vs v1

| | v1 (old) | v2 (new) |
|---|---|---|
| Delivery | `Gmail:create_draft` — Nuwan had to open Gmail and click Send | `Spices GoviHub Admin:send_admin_email` — autonomous, no human in the loop |
| Recipients | one address in the draft body | `ADMIN_REPORT_RECIPIENTS` env var (comma-separated) |
| Body | HTML embedded in the draft | HTML passed directly to the tool |
| Evidence | a draft ID | `status_code`, `message_id`, `recipient_count` from SendGrid |
| Failure mode | Silent — the draft sits in Gmail unsent | Loud — tool raises, Claude sees the error, reports it in the reply |

## The updated Claude automation instruction

Replace the old step that called `Gmail:create_draft` with this verbatim:

> **Step 4. Send the report**
>
> Use `Spices GoviHub Admin:send_admin_email` with:
>
> - `subject`: `GoviHub Spices — Daily Report — {{formatted_date_sl}}`
>   (e.g. `GoviHub Spices — Daily Report — 2026-04-18 (Sat)`)
> - `html_body`: the full HTML assembled in Step 3
> - Omit `to` — the tool will default to `ADMIN_REPORT_RECIPIENTS` from the VPS env file.
>
> Do NOT pass `cc` or `bcc` unless Nuwan explicitly adds recipients for a given run.
>
> **Step 5. Reply**
>
> The tool returns `{status_code, message_id, recipient_count}`. Reply with one line:
>
> `Daily report emailed to {{recipient_count}} admin(s) at {{timestamp_sl}}. SendGrid message_id: {{message_id}}`
>
> If the tool raises, reply with:
>
> `FAILED to send daily report — SendGrid error: {{error_message}}. Check SendGrid dashboard and VPS env.`

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

When the SendGrid API key was provisioned, one of these two paths was chosen:

- **Path A — Domain auth for govihublk.com.** SPF, DKIM, and DMARC DNS records added at the registrar. `SENDGRID_FROM_EMAIL` can be anything `@govihublk.com`. Highest deliverability. Recommended.
- **Path B — Single-sender verification.** One specific from-address (e.g. `nuwans@govihublk.com`) verified by email click. Works immediately but deliverability is weaker for transactional sends.

If Path B is in use at launch, schedule a follow-up task to migrate to Path A — the `ADMIN_REPORT_RECIPIENTS` default (`govihub.ai@gmail.com`) is Gmail so Gmail's spam classifier is the hard gate.

## Rollback

If v2 misfires before Nuwan can debug:

1. Flip the automation back to `Gmail:create_draft` in one edit.
2. No code rollback needed — `send_admin_email` stays registered, just unused.
3. Investigate SendGrid activity feed at https://app.sendgrid.com/email_activity, check VPS logs:
   ```bash
   ssh govihub-mumbai docker logs govihub-spices-govihub-api-spices-1 --tail 100 | grep -iE 'sendgrid|email'
   ```

## Schedule

Existing cron stays: **07:00 Asia/Colombo** daily. v2 is transparent to the scheduler.
