import os
import re
import time
import email
import imaplib
import threading
from email.header import decode_header
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

# Load environment
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv()

IMAP_HOST = os.getenv("IMAP_HOST", "imap.gmail.com")
IMAP_PORT = int(os.getenv("IMAP_PORT", "993"))
IMAP_USER = os.getenv("IMAP_USER", os.getenv("SMTP_USER", os.getenv("SMTP_EMAIL", ""))).strip()
IMAP_PASSWORD = os.getenv("IMAP_PASSWORD", os.getenv("SMTP_PASSWORD", "")).strip().replace(" ", "")

def clean_doctor_reply_text(raw_body: str) -> str:
    """
    Strips out standard email reply quotes (e.g., 'On Wed... wrote:',
    '---------- Forwarded message ---------', '-----------------------', etc.)
    and returns just the doctor's actual response.
    """
    if not raw_body:
        return ""

    lines = raw_body.splitlines()
    clean_lines = []

    for line in lines:
        stripped = line.strip()
        
        # Stop at standard quote markers
        if re.match(r"^On\s+.+wrote:$", stripped, re.IGNORECASE):
            break
        if re.match(r"^-{3,}.*-$", stripped):
            break
        if stripped.startswith(">"):
            continue
        if re.match(r"^From:\s+", stripped, re.IGNORECASE):
            break
        if re.match(r"^Sent:\s+", stripped, re.IGNORECASE):
            break
        if "Sent via RespiGuard" in stripped:
            break

        clean_lines.append(line)

    result = "\n".join(clean_lines).strip()
    return result if result else raw_body.strip()

def process_single_email(msg_bytes) -> Optional[Dict[str, Any]]:
    """
    Parses a raw email and extracts doctor reply content and Patient ID.
    """
    try:
        msg = email.message_from_bytes(msg_bytes)
        
        # Decode Subject
        raw_subj = msg.get("Subject", "")
        subject_parts = decode_header(raw_subj)
        subject = ""
        for part, enc in subject_parts:
            if isinstance(part, bytes):
                subject += part.decode(enc or "utf-8", errors="ignore")
            else:
                subject += part

        # Decode From / Doctor Email
        raw_from = msg.get("From", "")
        from_parts = decode_header(raw_from)
        sender_str = ""
        for part, enc in from_parts:
            if isinstance(part, bytes):
                sender_str += part.decode(enc or "utf-8", errors="ignore")
            else:
                sender_str += part

        # Extract email address inside <...>
        email_match = re.search(r'<([^>]+)>', sender_str)
        doctor_email = email_match.group(1).lower().strip() if email_match else sender_str.lower().strip()

        # Extract Patient ID code from Subject e.g. [Patient ID: RESP-104]
        pid_match = re.search(r'\[Patient ID:\s*([A-Za-z0-9\-]+)\]', subject, re.IGNORECASE)
        if not pid_match:
            # Also check body for Patient ID
            pass
        patient_id_code = pid_match.group(1).upper() if pid_match else None

        # Extract Plain Text Body
        body = ""
        if msg.is_multipart():
            for part in msg.walk():
                ctype = part.get_content_type()
                cdispo = str(part.get("Content-Disposition"))
                if ctype == "text/plain" and "attachment" not in cdispo:
                    payload = part.get_payload(decode=True)
                    if payload:
                        charset = part.get_content_charset() or "utf-8"
                        body = payload.decode(charset, errors="ignore")
                        break
        else:
            payload = msg.get_payload(decode=True)
            if payload:
                charset = msg.get_content_charset() or "utf-8"
                body = payload.decode(charset, errors="ignore")

        # If patient ID wasn't in subject, search body
        if not patient_id_code and body:
            body_pid = re.search(r'Patient ID:\s*([A-Za-z0-9\-]+)', body, re.IGNORECASE)
            if body_pid:
                patient_id_code = body_pid.group(1).upper()

        if not patient_id_code:
            return None

        clean_text = clean_doctor_reply_text(body)
        if not clean_text:
            clean_text = "Doctor acknowledged your update."

        return {
            "patient_id_code": patient_id_code,
            "doctor_email": doctor_email,
            "subject": subject,
            "message_body": clean_text
        }
    except Exception as e:
        print(f"[IMAP Listener] Error parsing email: {e}")
        return None

def run_imap_sync_cycle(db_service) -> int:
    """
    Executes one IMAP check cycle for unseen doctor replies.
    Returns number of new replies saved.
    """
    if not (IMAP_USER and IMAP_PASSWORD):
        return 0

    saved_count = 0
    mail = None

    try:
        mail = imaplib.IMAP4_SSL(IMAP_HOST, IMAP_PORT, timeout=10)
        mail.login(IMAP_USER, IMAP_PASSWORD)
        mail.select("inbox")

        # Server-side fast search specifically for Patient ID emails (instant on Gmail)
        status, data = mail.search(None, '(UNSEEN SUBJECT "Patient ID")')
        if status != "OK" or not data[0]:
            mail.logout()
            return 0

        msg_ids = data[0].split()

        for msg_id in msg_ids:
            fetch_status, fetch_data = mail.fetch(msg_id, "(RFC822)")
            if fetch_status != "OK" or not fetch_data:
                continue

            parsed = process_single_email(fetch_data[0][1])
            if not parsed:
                continue

            patient_id_code = parsed["patient_id_code"]

            # Query Supabase for matching doctor & patient by patient_id_code
            import httpx
            from db_service import HEADERS, SUPABASE_URL
            
            with httpx.Client(timeout=8.0) as client:
                doc_res = client.get(
                    f"{SUPABASE_URL}/rest/v1/patient_doctors",
                    headers=HEADERS,
                    params={"patient_id_code": f"eq.{patient_id_code}", "select": "*"}
                )

                if doc_res.status_code == 200 and len(doc_res.json()) > 0:
                    matched_doc = doc_res.json()[0]
                    user_id = matched_doc["user_id"]
                    doctor_id = matched_doc["id"]

                    # Save doctor reply into Supabase
                    reply_payload = {
                        "user_id": user_id,
                        "doctor_id": doctor_id,
                        "sender_type": "doctor",
                        "patient_id_code": patient_id_code,
                        "subject": parsed["subject"],
                        "message_body": parsed["message_body"],
                        "email_status": "received_via_gmail_reply",
                        "is_read": False
                    }

                    save_res = client.post(
                        f"{SUPABASE_URL}/rest/v1/doctor_messages",
                        headers=HEADERS,
                        json=reply_payload
                    )

                    if save_res.status_code in (200, 201):
                        saved_count += 1
                        print(f"\n{'='*70}")
                        print(f"[REAL DOCTOR REPLY RECEIVED VIA GMAIL]")
                        print(f"Patient ID : {patient_id_code}")
                        print(f"Doctor     : {matched_doc.get('doctor_name')} ({parsed['doctor_email']})")
                        print(f"Advice     : {parsed['message_body']}")
                        print(f"{'='*70}\n")
                        
                        # Mark as read in Gmail only when processed
                        mail.store(msg_id, "+FLAGS", "\\Seen")

        mail.logout()
    except Exception as e:
        # Graceful non-fatal log
        if mail:
            try:
                mail.logout()
            except Exception:
                pass
        # Suppress routine socket timeouts
        if "timed out" not in str(e).lower():
            print(f"[IMAP Listener] Sync notice: {e}")

    return saved_count

class IMAPAutoSyncWorker:
    """
    Background worker thread that runs every 8 seconds in the background
    without blocking any FastAPI routes.
    """
    def __init__(self, db_service, poll_interval: int = 8):
        self.db_service = db_service
        self.poll_interval = poll_interval
        self._running = False
        self._thread: Optional[threading.Thread] = None

    def start(self):
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True, name="IMAPSyncWorker")
        self._thread.start()
        print(f"[IMAP Worker] Background Gmail Auto-Sync Worker started (checking every {self.poll_interval}s)")

    def _loop(self):
        # Initial wait of 4 seconds on startup
        time.sleep(4)
        while self._running:
            try:
                run_imap_sync_cycle(self.db_service)
            except Exception as e:
                print(f"[IMAP Worker] Error in loop: {e}")
            time.sleep(self.poll_interval)

    def stop(self):
        self._running = False
