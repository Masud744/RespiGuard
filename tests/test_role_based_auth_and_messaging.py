import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.db_service import db_service
from backend.auth import create_access_token
from backend.email_service import _otp_store

def mock_verify_email(email: str):
    _otp_store[email.lower().strip()] = {"verified": True}

client = TestClient(app)

import uuid

def test_patient_signup_assigns_unique_patient_id():
    """Verify that a patient signup automatically assigns a unique formatted PAT-xxxxxxx ID."""
    email = f"test.patient.{uuid.uuid4().hex[:8]}@hospital.org"
    mock_verify_email(email)

    payload = {
        "email": email,
        "password": "Password123!",
        "full_name": "Unique ID Patient",
        "role": "patient",
        "age": 25,
        "sex": "female",
        "severity": "Moderate",
        "pef_best": 480.0
    }
    res = client.post("/api/auth/signup", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "user" in data
    user = data["user"]
    assert user["role"] == "patient"
    assert "patient_id_code" in user
    assert user["patient_id_code"].startswith("PAT-")

def test_doctor_signup_and_credentials():
    """Verify doctor signup captures BMDC license, hospital, specialty, and issues doctor token."""
    email = f"dr.tahmina.{uuid.uuid4().hex[:8]}@hospital.org"
    mock_verify_email(email)

    payload = {
        "email": email,
        "password": "DoctorSecret123!",
        "full_name": "Dr. Tahmina Akter",
        "role": "doctor",
        "bmdc_number": "BMDC-A-88124",
        "hospital": "National Institute of Diseases of the Chest and Hospital",
        "specialty": "Pediatric & Adult Pulmonology",
        "degrees": "MBBS, FCPS (Pulmonology), MD (Chest)",
        "phone": "+880 1711-223344"
    }
    res = client.post("/api/auth/signup", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "user" in data
    user = data["user"]
    assert user["role"] == "doctor"
    assert user.get("bmdc_number") == "BMDC-A-88124"
    assert "National Institute" in user.get("hospital", "")

def test_bidirectional_messaging_and_pairing():
    """Verify doctor can pair patient by code and messages flow bidirectionally."""
    # 1. Create a patient
    pat_email = f"chat.patient.{uuid.uuid4().hex[:8]}@hospital.org"
    mock_verify_email(pat_email)
    pat_res = client.post("/api/auth/signup", json={
        "email": pat_email,
        "password": "Password123!",
        "full_name": "Chat Patient",
        "role": "patient",
        "age": 28,
        "sex": "male",
        "severity": "Mild",
        "pef_best": 550.0,
        "patient_id_code": "PAT-2201031"
    })
    assert pat_res.status_code == 200
    pat_user = pat_res.json()["user"]
    pat_token = pat_res.json()["access_token"]
    pat_headers = {"Authorization": f"Bearer {pat_token}"}

    # 2. Create a doctor
    doc_email = f"dr.chat.{uuid.uuid4().hex[:8]}@hospital.org"
    mock_verify_email(doc_email)
    doc_res = client.post("/api/auth/signup", json={
        "email": doc_email,
        "password": "DoctorPass123!",
        "full_name": "Dr. Chat Specialist",
        "role": "doctor",
        "bmdc_number": "BMDC-A-99321",
        "hospital": "Dhaka Medical College",
        "specialty": "Pulmonology",
        "degrees": "MBBS, FCPS"
    })
    assert doc_res.status_code == 200
    doc_user = doc_res.json()["user"]
    doc_token = doc_res.json()["access_token"]
    doc_headers = {"Authorization": f"Bearer {doc_token}"}

    # 3. Doctor pairs patient by code
    pair_res = client.post("/api/doctor/pair-patient", json={
        "patient_id_code": "PAT-2201031"
    }, headers=doc_headers)
    assert pair_res.status_code == 200
    assert pair_res.json()["success"] is True

    # 4. Patient sends message to doctor
    send_msg_res = client.post("/api/messages/send", json={
        "doctor_id": str(doc_user["id"]),
        "patient_id_code": "PAT-2201031",
        "subject": "Peak flow drop",
        "message_body": "Doctor, my morning PEF dropped to 410 L/min.",
        "sender_type": "patient"
    }, headers=pat_headers)
    assert send_msg_res.status_code == 200
    assert send_msg_res.json()["success"] is True

    # 5. Doctor sends prescription/advice message to patient
    reply_msg_res = client.post("/api/messages/send", json={
        "doctor_id": str(doc_user["id"]),
        "patient_id": str(pat_user["id"]),
        "patient_id_code": "PAT-2201031",
        "subject": "Inhaler Advisory",
        "message_body": "Increase your maintenance budesonide/formoterol to 2 puffs twice daily.",
        "sender_type": "doctor"
    }, headers=doc_headers)
    assert reply_msg_res.status_code == 200
    assert reply_msg_res.json()["success"] is True

    # 6. Verify messages retrieval for patient
    pat_msgs = client.get("/api/messages", headers=pat_headers).json()["messages"]
    assert len(pat_msgs) >= 2
    assert any(m.get("sender_type") == "doctor" for m in pat_msgs)
    assert any(m.get("sender_type") == "patient" for m in pat_msgs)

    # 7. Verify messages retrieval for doctor
    doc_msgs = client.get("/api/messages", headers=doc_headers).json()["messages"]
    assert len(doc_msgs) >= 2
