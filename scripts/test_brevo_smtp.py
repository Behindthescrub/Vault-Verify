#!/usr/bin/env python3
"""Test the Brevo SMTP key against smtp-relay.brevo.com (auth only, then a real send)."""
import smtplib
import ssl
import sys
from email.mime.text import MIMEText
from email.header import Header

KEY = sys.argv[1] if len(sys.argv) > 1 else ""
TO = sys.argv[2] if len(sys.argv) > 2 else "myzipvault@gmail.com"
HOST = "smtp-relay.brevo.com"

def try_auth(port, user, pw):
    try:
        s = smtplib.SMTP(HOST, port, timeout=25)
        code, _ = s.ehlo()
        s.starttls(context=ssl.create_default_context())
        s.ehlo()
        s.login(user, pw)
        s.quit()
        return f"OK (login as {user[:14]}…)"
    except Exception as e:
        return f"FAIL: {type(e).__name__}: {e}"

print(f"--- auth tests on {HOST} ---")
for port in (587, 2525):
    print(f"port {port}, user=SMTPKEY :", try_auth(port, KEY, KEY))
    print(f"port {port}, user=email    :", try_auth(port, "myzipvault@gmail.com", KEY))

def try_send(port, user, pw):
    try:
        s = smtplib.SMTP(HOST, port, timeout=25)
        s.starttls(context=ssl.create_default_context())
        s.login(user, pw)
        msg = MIMEText("<b>VaultVerify</b> — SMTP relay test from the Recruiter tool.", "html", "utf-8")
        msg["Subject"] = Header("VaultVerify SMTP test", "utf-8")
        msg["From"] = "VaultVerify <myzipvault@gmail.com>"
        msg["To"] = TO
        s.send_message(msg)
        s.quit()
        return "SEND OK"
    except Exception as e:
        return f"SEND FAIL: {type(e).__name__}: {e}"

print("--- send test ---")
print(try_send(587, KEY, KEY))
