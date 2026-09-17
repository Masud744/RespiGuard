import os
import hashlib
import secrets
import smtplib
import httpx
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Dict, Any, List
from datetime import datetime
from dotenv import load_dotenv

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv()

# Supabase REST Database credentials (REQUIRED)
SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "").strip()

if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    raise RuntimeError(
        "Missing required Supabase configuration! "
        "Please ensure SUPABASE_URL and SUPABASE_ANON_KEY are set in your .env file."
    )

# SMTP Server credentials (supports both standard and alias variable names)
SMTP_HOST = os.getenv("SMTP_HOST", os.getenv("SMTP_SERVER", "smtp.gmail.com")).strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", os.getenv("SMTP_EMAIL", "")).strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").strip()
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", SMTP_USER or "alerts@respiguard.ai").strip()

HEADERS = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000)
    return f"{salt}${key.hex()}"

def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt, key_hex = stored_hash.split('$')
        computed = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000)
        return secrets.compare_digest(computed.hex(), key_hex)
    except Exception:
        return False

def dispatch_email_to_doctor(
    doctor_email: str, 
    doctor_name: str, 
    patient_id_code: str, 
    patient_name: str, 
    patient_email: str, 
    subject: str, 
    message_body: str
) -> Dict[str, Any]:
    """
    Sends an email to the doctor with Patient ID prominent in Subject & Top of Body.
    If SMTP server is not configured, logs the dispatch gracefully.
    """
    full_subject = f"[Patient ID: {patient_id_code}] {subject}"
    
    body_text = f"""Patient ID: {patient_id_code}
Patient Name: {patient_name}
Patient Email: {patient_email}
Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
------------------------------------------------------------

{message_body}

------------------------------------------------------------
Sent via RespiGuard Portable Asthma Monitoring System
"""

    if SMTP_HOST and SMTP_USER and SMTP_PASSWORD:
        try:
            msg = MIMEMultipart()
            msg['From'] = f"{patient_name} (via RespiGuard) <{SMTP_FROM_EMAIL}>"
            msg['To'] = doctor_email
            msg['Reply-To'] = patient_email
            msg['Subject'] = full_subject
            msg.attach(MIMEText(body_text, 'plain'))

            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
                server.starttls()
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.send_message(msg)
            
            print(f"[Email Service] Email sent successfully to {doctor_email} for Patient ID {patient_id_code}")
            return {"status": "sent", "method": "smtp", "subject": full_subject}
        except Exception as e:
            print(f"[Email Service] SMTP error: {e}. Logging to simulated dispatch.")
            return {"status": "simulated", "method": "smtp_fallback", "subject": full_subject, "error": str(e)}
    else:
        # Graceful simulation log
        print(f"\n{'='*70}")
        print(f"[EMAIL DISPATCH TO DOCTOR] -> To: {doctor_name} <{doctor_email}>")
        print(f"Subject: {full_subject}")
        print(f"Content:\n{body_text}")
        print(f"{'='*70}\n")
        return {"status": "sent", "method": "simulated", "subject": full_subject}

class DatabaseService:
    def __init__(self):
        self.base_url = f"{SUPABASE_URL}/rest/v1"

    # =========================================================================
    # User Profile & Auth
    # =========================================================================

    def signup_user(self, data: Dict[str, Any]) -> Dict[str, Any]:
        email = data['email'].strip().lower()
        
        with httpx.Client(timeout=10.0) as client:
            check_res = client.get(
                f"{self.base_url}/user_profiles",
                headers=HEADERS,
                params={"email": f"eq.{email}", "select": "id,email"}
            )
            if check_res.status_code == 200 and len(check_res.json()) > 0:
                return {
                    "success": False,
                    "error": "Email already registered"
                }

        pwd_hash = hash_password(data['password'])
        age = float(data.get('age', 22))
        
        if age < 30:
            age_range = "18-29yo"
        elif age < 40:
            age_range = "30-39yo"
        elif age < 50:
            age_range = "40-49yo"
        else:
            age_range = "50+yo"

        payload = {
            "email": email,
            "password_hash": pwd_hash,
            "full_name": data.get('full_name', 'Patient User').strip(),
            "severity": data.get('severity', 'Mild'),
            "age": age,
            "age_range": data.get('age_range', age_range),
            "sex": data.get('sex', 'male').lower(),
            "pef_best": float(data.get('pef_best', 520.0))
        }

        with httpx.Client(timeout=10.0) as client:
            res = client.post(
                f"{self.base_url}/user_profiles",
                headers=HEADERS,
                json=payload
            )
            if res.status_code in (200, 201):
                created = res.json()[0]
                user_info = {k: v for k, v in created.items() if k != 'password_hash'}
                return {
                    "success": True,
                    "user": user_info,
                    "message": "User registered successfully"
                }
            else:
                return {
                    "success": False,
                    "error": f"Database error: {res.text}"
                }

    def login_user(self, email: str, password: str) -> Dict[str, Any]:
        email_clean = email.strip().lower()
        with httpx.Client(timeout=10.0) as client:
            res = client.get(
                f"{self.base_url}/user_profiles",
                headers=HEADERS,
                params={"email": f"eq.{email_clean}", "select": "*"}
            )
            if res.status_code == 200 and len(res.json()) > 0:
                user_row = res.json()[0]
                if verify_password(password, user_row['password_hash']):
                    user_info = {k: v for k, v in user_row.items() if k != 'password_hash'}
                    return {
                        "success": True,
                        "user": user_info
                    }
            
            return {
                "success": False,
                "error": "Invalid email or password"
            }

    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        with httpx.Client(timeout=10.0) as client:
            res = client.get(
                f"{self.base_url}/user_profiles",
                headers=HEADERS,
                params={"id": f"eq.{user_id}", "select": "*"}
            )
            if res.status_code == 200 and len(res.json()) > 0:
                user_row = res.json()[0]
                return {k: v for k, v in user_row.items() if k != 'password_hash'}
        return None

    # =========================================================================
    # Doctor Directory Management (Add / List / Remove Doctors)
    # =========================================================================

    def add_doctor(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Adds a doctor's info for a patient (Doctor Name, Doctor Email, Patient ID Code).
        """
        payload = {
            "user_id": data['user_id'],
            "doctor_name": data['doctor_name'].strip(),
            "doctor_email": data['doctor_email'].strip().lower(),
            "patient_id_code": data['patient_id_code'].strip().upper(),
            "specialty": data.get('specialty', 'Pulmonologist').strip(),
            "hospital": data.get('hospital', 'Respiratory Clinic').strip()
        }

        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.post(
                    f"{self.base_url}/patient_doctors",
                    headers=HEADERS,
                    json=payload
                )
                if res.status_code in (200, 201):
                    return {"success": True, "doctor": res.json()[0]}
                else:
                    return {"success": False, "error": res.text}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_doctors(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Returns all doctors registered by this patient.
        """
        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.get(
                    f"{self.base_url}/patient_doctors",
                    headers=HEADERS,
                    params={
                        "user_id": f"eq.{user_id}",
                        "select": "*",
                        "order": "created_at.desc"
                    }
                )
                if res.status_code == 200:
                    return res.json()
        except Exception as e:
            print(f"[DB Service] Error fetching doctors: {e}")
        return []

    def delete_doctor(self, doctor_id: str, user_id: str) -> bool:
        """
        Removes a doctor from the patient's list.
        """
        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.delete(
                    f"{self.base_url}/patient_doctors",
                    headers=HEADERS,
                    params={"id": f"eq.{doctor_id}", "user_id": f"eq.{user_id}"}
                )
                return res.status_code in (200, 204)
        except Exception as e:
            print(f"[DB Service] Error deleting doctor: {e}")
            return False

    # =========================================================================
    # Doctor Messaging & Email Dispatch
    # =========================================================================

    def send_message_to_doctor(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        1. Dispatches email to Doctor with Patient ID at the beginning.
        2. Saves the message thread into Supabase database.
        """
        user_id = data['user_id']
        doctor_id = data['doctor_id']
        patient_id_code = data.get('patient_id_code', 'PAT-001')
        subject = data.get('subject', 'Health Query')
        message_body = data['message_body']

        # Get doctor details
        doctor_info = None
        user_info = self.get_user_by_id(user_id)
        patient_name = user_info.get('full_name', 'Patient') if user_info else 'Patient'
        patient_email = user_info.get('email', 'patient@respiguard.ai') if user_info else 'patient@respiguard.ai'

        with httpx.Client(timeout=10.0) as client:
            doc_res = client.get(
                f"{self.base_url}/patient_doctors",
                headers=HEADERS,
                params={"id": f"eq.{doctor_id}", "select": "*"}
            )
            if doc_res.status_code == 200 and len(doc_res.json()) > 0:
                doctor_info = doc_res.json()[0]

        if not doctor_info:
            return {"success": False, "error": "Doctor not found"}

        doctor_email = doctor_info['doctor_email']
        doctor_name = doctor_info['doctor_name']
        patient_id_code = doctor_info.get('patient_id_code', patient_id_code)

        # 1. Send Real Email (with Direct Doctor Reply portal link & SMTP delivery)
        try:
            from email_service import send_real_email_to_doctor
        except ImportError:
            from backend.email_service import send_real_email_to_doctor

        dispatch_result = send_real_email_to_doctor(
            doctor_email=doctor_email,
            doctor_name=doctor_name,
            patient_id_code=patient_id_code,
            patient_name=patient_name,
            patient_email=patient_email,
            subject=subject,
            message_body=message_body,
            doctor_id=doctor_id,
            user_id=user_id
        )

        # 2. Record message in Supabase
        message_payload = {
            "user_id": user_id,
            "doctor_id": doctor_id,
            "sender_type": "patient",
            "patient_id_code": patient_id_code,
            "subject": subject,
            "message_body": message_body,
            "email_status": dispatch_result.get("status", "sent"),
            "is_read": True
        }

        with httpx.Client(timeout=10.0) as client:
            msg_res = client.post(
                f"{self.base_url}/doctor_messages",
                headers=HEADERS,
                json=message_payload
            )
            if msg_res.status_code in (200, 201):
                created_msg = msg_res.json()[0]
                return {
                    "success": True,
                    "message": created_msg,
                    "email_status": dispatch_result
                }
            else:
                return {"success": False, "error": msg_res.text}

    def record_doctor_reply(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Records a doctor's reply to a patient's message.
        """
        payload = {
            "user_id": data['user_id'],
            "doctor_id": data['doctor_id'],
            "sender_type": "doctor",
            "patient_id_code": data.get('patient_id_code', 'PAT-001'),
            "subject": data.get('subject', 'Re: Health Update & Advisory'),
            "message_body": data['message_body'],
            "email_status": "received",
            "is_read": False,
            "reply_to_id": data.get('reply_to_id')
        }

        with httpx.Client(timeout=10.0) as client:
            res = client.post(
                f"{self.base_url}/doctor_messages",
                headers=HEADERS,
                json=payload
            )
            if res.status_code in (200, 201):
                return {"success": True, "message": res.json()[0]}
            return {"success": False, "error": res.text}

    def get_messages(self, user_id: str, doctor_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Fetches message threads for a user.
        """
        params = {
            "user_id": f"eq.{user_id}",
            "select": "*,patient_doctors(doctor_name,doctor_email,specialty,hospital)",
            "order": "created_at.asc"
        }
        if doctor_id:
            params["doctor_id"] = f"eq.{doctor_id}"

        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.get(
                    f"{self.base_url}/doctor_messages",
                    headers=HEADERS,
                    params=params
                )
                if res.status_code == 200:
                    return res.json()
        except Exception as e:
            print(f"[DB Service] Error fetching messages: {e}")
        return []

    def mark_message_read(self, message_id: str, user_id: str) -> bool:
        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.patch(
                    f"{self.base_url}/doctor_messages",
                    headers=HEADERS,
                    params={"id": f"eq.{message_id}", "user_id": f"eq.{user_id}"},
                    json={"is_read": True}
                )
                return res.status_code in (200, 204)
        except Exception as e:
            print(f"[DB Service] Error marking read: {e}")
            return False

    # =========================================================================
    # Telemetry Persistence
    # =========================================================================

    def save_telemetry_reading(self, telemetry: Dict[str, Any], prediction: Dict[str, Any], user_id: Optional[str] = None) -> bool:
        probs = prediction.get('probabilities', {})
        payload = {
            "user_id": user_id,
            "device_node": telemetry.get('device_node', 'ESP32-RespiGuard-01'),
            "temperature": float(telemetry.get('temperature', 25.0)),
            "humidity": float(telemetry.get('humidity', 60.0)),
            "pm1_0": float(telemetry.get('pm1_0', 10.0)),
            "pm2_5": float(telemetry.get('pm2_5', 15.0)),
            "pm10": float(telemetry.get('pm10', 25.0)),
            "mq135": float(telemetry.get('mq135', 412.0)),
            "predicted_risk": prediction.get('prediction', 'Green'),
            "confidence": float(prediction.get('confidence', 90.0)),
            "prob_green": float(probs.get('Green', 90.0)),
            "prob_yellow": float(probs.get('Yellow', 8.0)),
            "prob_red": float(probs.get('Red', 2.0)),
            "explanation": prediction.get('explanation', ''),
            "recommendation": prediction.get('recommendation', '')
        }

        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.post(
                    f"{self.base_url}/telemetry_readings",
                    headers=HEADERS,
                    json=payload
                )
                return res.status_code in (200, 201)
        except Exception as e:
            print(f"[DB Service] Error saving telemetry reading: {e}")
            return False

    def get_recent_telemetry(self, user_id: Optional[str] = None, limit: int = 30) -> List[Dict[str, Any]]:
        params = {
            "select": "*",
            "order": "created_at.desc",
            "limit": str(limit)
        }
        if user_id:
            params["user_id"] = f"eq.{user_id}"

        try:
            with httpx.Client(timeout=10.0) as client:
                res = client.get(
                    f"{self.base_url}/telemetry_readings",
                    headers=HEADERS,
                    params=params
                )
                if res.status_code == 200:
                    return res.json()
        except Exception as e:
            print(f"[DB Service] Error fetching telemetry: {e}")
        return []

db_service = DatabaseService()
