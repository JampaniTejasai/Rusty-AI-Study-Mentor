"""
ZAP authentication hook script.
Called by ZAP's HTTP Sender script to inject Firebase auth token
into every request after initial login.

Usage: Load this as an "HTTP Sender" script in ZAP, or reference it
in the automation framework config.
"""
import json
import urllib.request

AUTH_URL = "http://localhost:5173/api/auth/login"
CACHED_TOKEN = None


def get_token():
    """Login via the Rusty API and cache the Firebase token."""
    global CACHED_TOKEN
    if CACHED_TOKEN:
        return CACHED_TOKEN

    payload = json.dumps({
        "student_id": "KHEL-2026-001",
        "pin": "1234"
    }).encode("utf-8")

    req = urllib.request.Request(
        AUTH_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
            CACHED_TOKEN = data.get("token") or data.get("idToken") or data.get("access_token")
            return CACHED_TOKEN
    except Exception as e:
        print(f"[auth-hook] Login failed: {e}")
        return None


def sendingRequest(msg, initiator, helper):
    """ZAP callback — inject auth header into outgoing requests."""
    url = msg.getRequestHeader().getURI().toString()

    # Skip login endpoint itself and static assets
    if "/auth/login" in url or any(url.endswith(ext) for ext in [".js", ".css", ".png", ".svg", ".ico"]):
        return

    token = get_token()
    if token:
        msg.getRequestHeader().setHeader("Authorization", f"Bearer {token}")


def responseReceived(msg, initiator, helper):
    """ZAP callback — handle 401 by refreshing token."""
    global CACHED_TOKEN
    if msg.getResponseHeader().getStatusCode() == 401:
        CACHED_TOKEN = None  # Force re-login on next request
