# BLOCKED — needs the manager

## 1. `git push origin spices` — Tier 0, not named in the run instruction

Four commits are **local-only**. Production is already running this exact code (deployed by file
copy into the VPS build context, then rebuilt), but `origin` and `/opt/govihub-spices` do not yet
have the commits.

```
aad584c  feat(auth): per-IP rate limits on beta register and login (G6.4)
db4d332  feat(email): Resend Inbound webhook for mail to govihublk.com (T7)
fce1792  chore(security): purge rotated admin credential from the tree (T5)
(+ the INTERVIEW_HARDENING_VERIFICATION.md / BLOCKED.md commit)
```

Pushing to a git remote is Tier 0 in the autonomy charter and stays gated regardless of phrasing.
The run instruction did not name it, so it was not run.

**To reconcile, from this machine:**

```bash
git push origin spices
```

**Then on the VPS** — the working tree there holds the same content but is not committed, so a plain
`git pull` will refuse. Discard the identical local copies first:

```bash
ssh govihub-mumbai 'cd /opt/govihub-spices && git checkout -- govihub-api/app/auth/beta_router.py govihub-api/app/config.py govihub-api/app/main.py admin_playwright_test.py e2e-v3/ scripts/ && git pull'
```

Nothing is lost — the files being discarded are byte-identical to what the pull brings in. Verify
afterwards that the tree is clean and prod still answers:

```bash
ssh govihub-mumbai 'cd /opt/govihub-spices && git status --short && bash /root/smoke_spices.sh | tail -3'
```

`git checkout -- <file>` is on the forbidden list for me, which is why this step is here rather than
done.

---

## 2. Admin password location (action needed only if you log in)

Rotated 2026-08-24. The old value now returns 401. The new one lives **only** here:

```
/opt/govihub-spices/.env.spices   ->   GOVIHUB_ADMIN_PW
```

Read it there to sign into the admin panel. Test harnesses need it exported first:

```bash
ssh govihub-mumbai 'grep ^GOVIHUB_ADMIN_PW= /opt/govihub-spices/.env.spices'
```

---

## 3. Watch items — not blocking, no action required tonight

- **DB connections peaked at 83/100** during the 200-concurrent burst. Fine as configured. If the
  API worker count ever increases, raise Postgres `max_connections` to 200 *first*.
- **OpenRouter $5/week cap** — unchanged. Manager already decided to leave it. If exhausted during
  the spike: moderation fails open (safe), crop diagnosis breaks visibly.
- **Mail is a catch-all.** Any address at `govihublk.com` now lands in Resend and pings
  `govihub.ai@gmail.com`. Expect spam to the catch-all to generate notifications.
