import base64, hashlib, hmac, json, time, sys
sys.path.insert(0, "/app")

from app.config import settings

SECRET_RAW = base64.b64encode(b"govihub-test-signing-key-0123456789").decode()
settings.RESEND_INBOUND_WEBHOOK_SECRET = "whsec_" + SECRET_RAW
settings.RESEND_FROM_EMAIL = "reports@govihublk.com"  # prod value; guard is a no-op when unset

sent = []
import app.utils.email as em
class StubEmail:
    def send_html(self, to, subject, html_body, **kw):
        sent.append({"to": to, "subject": subject, "html": html_body})
        return {"message_id": "stub", "recipient_count": len(to)}
em.EmailService = StubEmail

from fastapi.testclient import TestClient
import app.main as m
client = TestClient(m.create_app() if hasattr(m, "create_app") else m.app)

URL = "/api/v1/webhooks/resend/inbound"

def sign(body: bytes, msg_id="msg_test_1", ts=None):
    ts = str(int(time.time())) if ts is None else str(ts)
    key = base64.b64decode(SECRET_RAW)
    signed = b"%s.%s.%s" % (msg_id.encode(), ts.encode(), body)
    sig = base64.b64encode(hmac.new(key, signed, hashlib.sha256).digest()).decode()
    return {"svix-id": msg_id, "svix-timestamp": ts, "svix-signature": "v1," + sig}

payload = {
    "type": "email.received",
    "created_at": "2026-08-24T00:00:00.000Z",
    "data": {
        "email_id": "56761188-7520-42d8-8898-ff6fc54ce618",
        "from": "farmer@example.com",
        "to": ["support@govihublk.com"],
        "cc": [], "bcc": [],
        "received_for": ["support@govihublk.com"],
        "message_id": "<abc@example.com>",
        "subject": "Please delete my account",
        "attachments": [],
    },
}
body = json.dumps(payload).encode()

results = []
def check(label, cond, extra=""):
    results.append(cond)
    print(("  PASS  " if cond else "  FAIL  ") + label + ("  " + str(extra) if extra else ""))

# 1. valid signature -> 200 + admin notified
r = client.post(URL, content=body, headers=sign(body))
check("valid signature -> 200", r.status_code == 200, r.status_code)
check("admin notified", len(sent) == 1, sent[0]["subject"] if sent else "no email")
check("notification names the sender", sent and "farmer@example.com" in sent[0]["html"])
check("notification carries email_id", sent and "56761188" in sent[0]["html"])

# 2. tampered body -> 401
sent.clear()
hdrs = sign(body)
r = client.post(URL, content=body.replace(b"Please delete", b"Please DELETE"), headers=hdrs)
check("tampered body -> 401", r.status_code == 401, r.status_code)
check("no email on tampered body", len(sent) == 0)

# 3. wrong secret -> 401
bad = dict(hdrs); bad["svix-signature"] = "v1," + base64.b64encode(b"x"*32).decode()
r = client.post(URL, content=body, headers=bad)
check("wrong signature -> 401", r.status_code == 401, r.status_code)

# 4. missing headers -> 401
r = client.post(URL, content=body)
check("missing svix headers -> 401", r.status_code == 401, r.status_code)

# 5. stale timestamp (replay) -> 401
r = client.post(URL, content=body, headers=sign(body, ts=int(time.time()) - 3600))
check("stale timestamp -> 401", r.status_code == 401, r.status_code)

# 6. self-mail loop guard
sent.clear()
loop = json.loads(body)
loop["data"]["from"] = "reports@govihublk.com"
lb = json.dumps(loop).encode()
r = client.post(URL, content=lb, headers=sign(lb))
check("self-mail skipped (loop guard)", r.status_code == 200 and r.json().get("status") == "skipped_self", r.json())
check("no email sent for self-mail", len(sent) == 0)

# 7. other event type ignored
sent.clear()
other = {"type": "email.delivered", "data": {}}
ob = json.dumps(other).encode()
r = client.post(URL, content=ob, headers=sign(ob))
check("non-received event ignored", r.status_code == 200 and r.json().get("status") == "ignored", r.json())
check("no email for other event", len(sent) == 0)

print()
print("RESULT: %d/%d passed" % (sum(results), len(results)))
sys.exit(0 if all(results) else 1)
