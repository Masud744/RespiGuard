import os
import smtplib
import random
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv()

SMTP_HOST = os.getenv("SMTP_HOST", os.getenv("SMTP_SERVER", "smtp.gmail.com")).strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", os.getenv("SMTP_EMAIL", "")).strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").strip()
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", SMTP_USER or "alerts@respiguard.ai").strip()

# In-memory OTP storage: { email: { 'otp': '123456', 'expires_at': datetime, 'verified': bool } }
_otp_store: Dict[str, Dict[str, Any]] = {}

def is_smtp_configured() -> bool:
    return bool(SMTP_USER and SMTP_PASSWORD and SMTP_HOST)

# ==============================================================================
# OTP Verification Functions
# ==============================================================================

def generate_and_save_otp(email_address: str) -> str:
    otp = f"{random.randint(100000, 999999)}"
    _otp_store[email_address.lower().strip()] = {
        "otp": otp,
        "expires_at": datetime.now() + timedelta(minutes=10),
        "verified": False
    }
    return otp

def verify_otp_code(email_address: str, otp_code: str) -> Dict[str, Any]:
    key = email_address.lower().strip()
    record = _otp_store.get(key)
    
    if not record:
        return {"success": False, "error": "No verification code requested for this email."}
    
    if datetime.now() > record["expires_at"]:
        return {"success": False, "error": "Verification code expired. Please request a new one."}
    
    if record["otp"] != otp_code.strip():
        return {"success": False, "error": "Invalid 6-digit verification code."}
    
    record["verified"] = True
    return {"success": True, "message": "Email verified successfully."}

def is_email_verified(email_address: str) -> bool:
    key = email_address.lower().strip()
    record = _otp_store.get(key)
    return bool(record and record.get("verified"))

def clear_email_otp(email_address: str):
    key = email_address.lower().strip()
    if key in _otp_store:
        del _otp_store[key]

def send_otp_email(to_email: str, full_name: str = "Patient User") -> Dict[str, Any]:
    otp = generate_and_save_otp(to_email)
    subject = f"Your RespiGuard Email Verification Code: {otp}"

    text_body = f"""Hello {full_name},

Your RespiGuard verification code is: {otp}

This code will expire in 10 minutes. Please enter it to complete your account registration.

Best regards,
RespiGuard Medical Team
"""

    html_body = f"""
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; background-color: #060f0c; color: #f1f5f9; padding: 20px;">
  <div style="max-width: 500px; margin: 0 auto; background: #0a1713; border: 1px solid #10b98140; border-radius: 16px; padding: 28px; text-align: center;">
    <h2 style="color: #00e599; margin-bottom: 8px;">RespiGuard Verification</h2>
    <p style="font-size: 14px; color: #cbd5e1;">Hello {full_name}, use the code below to complete your registration:</p>
    <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #00e599; background: #060f0c; padding: 14px; border-radius: 12px; border: 1px solid #00e59950; margin: 20px 0; font-family: monospace;">
      {otp}
    </div>
    <p style="font-size: 12px; color: #94a3b8;">This code expires in 10 minutes.</p>
  </div>
</body>
</html>
"""

    if is_smtp_configured():
        try:
            msg = MIMEMultipart("alternative")
            msg['From'] = f"RespiGuard Verification <{SMTP_FROM_EMAIL}>"
            msg['To'] = to_email
            msg['Subject'] = subject
            msg.attach(MIMEText(text_body, 'plain'))
            msg.attach(MIMEText(html_body, 'html'))

            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
                server.starttls()
                clean_pwd = SMTP_PASSWORD.replace(" ", "")
                server.login(SMTP_USER, clean_pwd)
                server.send_message(msg)

            print(f"[OTP Service] Sent OTP email to {to_email}")
            return {"success": True, "status": "sent"}
        except Exception as e:
            print(f"[OTP Service] SMTP error: {e}")
            return {"success": True, "status": "simulated", "otp_preview": otp}
    else:
        return {"success": True, "status": "simulated", "otp_preview": otp}

def send_risk_alert_email(to_email: str, patient_name: str, risk_label: str, confidence: float, telemetry: dict) -> bool:
    return True

# ==============================================================================
# Doctor Outbound Email (Option 1: Direct Gmail Reply Auto-Sync)
# ==============================================================================

def send_real_email_to_doctor(
    doctor_email: str,
    doctor_name: str,
    patient_id_code: str,
    patient_name: str,
    patient_email: str,
    subject: str,
    message_body: str,
    doctor_id: str,
    user_id: str
) -> Dict[str, Any]:
    """
    Sends a REAL email over Gmail SMTP to the doctor's email inbox with Patient ID.
    Includes clear instructions that replying directly from Gmail will sync with patient dashboard.
    """
    full_subject = f"[Patient ID: {patient_id_code}] {subject}"

    text_content = f"""======================================================================
PATIENT ID: {patient_id_code}
PATIENT NAME: {patient_name}
PATIENT EMAIL: {patient_email}
DATE: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
======================================================================

SUBJECT: {subject}

PATIENT INQUIRY & SYMPTOMS:
{message_body}

======================================================================
👉 HOW TO REPLY TO THIS PATIENT:
Simply reply directly to this email from your Gmail or email app. 
Your reply will be automatically parsed and delivered to Patient [{patient_id_code}]'s RespiGuard monitoring dashboard in real-time.
======================================================================
Sent via RespiGuard Real-Time Portable Asthma Monitoring System
"""

    html_content = f"""
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #060f0c; color: #f1f5f9; margin: 0; padding: 24px; }}
  .container {{ max-width: 620px; margin: 0 auto; background: #0a1713; border: 1px solid #00e59940; border-radius: 20px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }}
  .badge-id {{ display: inline-block; background: #00e59925; border: 1.5px solid #00e599; color: #00e599; font-weight: 800; font-family: monospace; font-size: 15px; padding: 8px 16px; border-radius: 10px; margin-bottom: 20px; letter-spacing: 0.5px; }}
  .header {{ font-size: 22px; font-weight: 800; color: #ffffff; margin-bottom: 6px; }}
  .meta {{ font-size: 13px; color: #94a3b8; margin-bottom: 24px; }}
  .message-box {{ background: #060f0c; border: 1px solid #1e293b; border-left: 4px solid #00e599; border-radius: 12px; padding: 20px; color: #e2e8f0; font-size: 14px; line-height: 1.65; margin-bottom: 24px; white-space: pre-wrap; }}
  .reply-instruction {{ background: linear-gradient(135deg, #103e32, #0d2a22); border: 1px solid #10b98150; border-radius: 14px; padding: 18px; text-align: left; margin-bottom: 20px; }}
  .footer {{ font-size: 11px; color: #64748b; margin-top: 24px; border-top: 1px solid #1e293b; padding-top: 16px; line-height: 1.5; }}
</style>
</head>
<body>
  <div class="container">
    <div class="badge-id">PATIENT ID: {patient_id_code}</div>
    <div class="header">New Patient Consultation Message</div>
    <div class="meta">From: <strong>{patient_name}</strong> ({patient_email}) • {datetime.now().strftime('%b %d, %Y - %I:%M %p')}</div>
    
    <div class="message-box">
      <strong style="color: #00e599; font-size: 15px;">Subject: {subject}</strong><br><br>
{message_body}
    </div>

    <div class="reply-instruction">
      <div style="font-size: 14px; color: #00e599; font-weight: 700; margin-bottom: 6px;">
        ✉️ How to reply to Patient [{patient_id_code}]:
      </div>
      <div style="font-size: 13px; color: #cbd5e1; line-height: 1.5;">
        Simply press <strong>Reply</strong> in your Gmail app and type your advice or medication instructions.<br>
        Our automated IMAP listener will immediately deliver your reply to the patient's portable monitor dashboard in real-time.
      </div>
    </div>

    <div class="footer">
      Sent via the <strong>RespiGuard Real-Time Portable Asthma Monitoring System</strong>.
    </div>
  </div>
</body>
</html>
"""

    if is_smtp_configured():
        try:
            msg = MIMEMultipart("alternative")
            msg['From'] = f"{patient_name} (via RespiGuard) <{SMTP_FROM_EMAIL}>"
            msg['To'] = doctor_email
            # Setting Reply-To to SMTP_USER ensures the doctor's reply comes back to SMTP_USER where IMAP listens!
            msg['Reply-To'] = SMTP_USER or patient_email
            msg['Subject'] = full_subject

            msg.attach(MIMEText(text_content, 'plain'))
            msg.attach(MIMEText(html_content, 'html'))

            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=12) as server:
                server.starttls()
                clean_pwd = SMTP_PASSWORD.replace(" ", "")
                server.login(SMTP_USER, clean_pwd)
                server.send_message(msg)

            print(f"[Email Service] REAL email delivered successfully to {doctor_name} <{doctor_email}>")
            return {
                "success": True,
                "status": "sent",
                "method": "smtp_real",
                "doctor_email": doctor_email,
                "subject": full_subject,
                "note": "Delivered over Gmail SMTP"
            }
        except Exception as e:
            print(f"[Email Service] SMTP Delivery Error: {e}")
            return {
                "success": False,
                "status": "failed",
                "method": "smtp_error",
                "error": str(e),
                "doctor_email": doctor_email
            }
    else:
        return {
            "success": True,
            "status": "simulated",
            "doctor_email": doctor_email,
            "subject": full_subject
        }
