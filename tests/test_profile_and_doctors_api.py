import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.db_service import db_service
from backend.auth import create_access_token

client = TestClient(app)

def test_doctors_directory():
    """Verify verified pulmonologists directory returns BMDC credentials"""
    response = client.get("/api/doctors/directory")
    assert response.status_code == 200
    data = response.json()
    assert "directory" in data
    assert len(data["directory"]) >= 3
    first_doc = data["directory"][0]
    assert "bmdc_number" in first_doc or "bmdc_reg_no" in first_doc
    assert "specialty" in first_doc
    assert "hospital" in first_doc

def test_profile_update_and_validation():
    """Verify updating baseline clinical parameters and validation rules"""
    user = db_service.get_user_by_email("test_profile_user@hospital.org")
    if not user:
        signup_res = db_service.signup_user({
            "email": "test_profile_user@hospital.org",
            "password": "Password123!",
            "full_name": "Profile Test User",
            "age": 25,
            "sex": "male",
            "severity": "Mild",
            "pef_best": 500.0,
            "role": "patient"
        })
        user = signup_res["user"]

    token = create_access_token(user_id=user["id"], email=user["email"], role=user.get("role", "patient"))
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Update profile successfully
    update_payload = {
        "user_id": user["id"],
        "full_name": "Dr. Profile Updated",
        "age": 30,
        "sex": "female",
        "severity": "Moderate",
        "pef_best": 550.0
    }
    response = client.put("/api/auth/profile", json=update_payload, headers=headers)
    assert response.status_code == 200
    res_data = response.json()
    assert res_data["success"] is True
    assert res_data["user"]["full_name"] == "Dr. Profile Updated"
    assert res_data["user"]["age"] == 30
    assert res_data["user"]["sex"] == "female"
    assert res_data["user"]["severity"] == "Moderate"
    assert res_data["user"]["pef_best"] == 550.0

    # 2. Validation: Age < 18 rejected (Adult cohort invariant)
    invalid_age_payload = {
        "user_id": user["id"],
        "age": 15
    }
    res_invalid_age = client.put("/api/auth/profile", json=invalid_age_payload, headers=headers)
    assert res_invalid_age.status_code in [400, 422]

    # 3. Validation: PEF <= 0 rejected
    invalid_pef_payload = {
        "user_id": user["id"],
        "pef_best": 0.0
    }
    res_invalid_pef = client.put("/api/auth/profile", json=invalid_pef_payload, headers=headers)
    assert res_invalid_pef.status_code in [400, 422]

def test_connect_doctor_and_patients():
    """Verify connecting doctor from directory and doctor's linked patient retrieval"""
    user = db_service.get_user_by_email("test_profile_user@hospital.org")
    if not user:
        signup_res = db_service.signup_user({
            "email": "test_profile_user@hospital.org",
            "password": "Password123!",
            "full_name": "Profile Test User",
            "age": 25,
            "sex": "male",
            "severity": "Mild",
            "pef_best": 500.0,
            "role": "patient"
        })
        user = signup_res["user"]
    assert user is not None

    token = create_access_token(user_id=user["id"], email=user["email"], role=user.get("role", "patient"))
    headers = {"Authorization": f"Bearer {token}"}

    connect_payload = {
        "user_id": user["id"],
        "doctor_name": "Dr. Tahmid Rahman",
        "doctor_email": "tahmid.rahman@dmc.edu.bd",
        "specialty": "Pulmonology & Critical Care",
        "hospital": "Dhaka Medical College Hospital",
        "bmdc_number": "BMDC-A-74129"
    }

    res_connect = client.post("/api/doctors/connect", json=connect_payload, headers=headers)
    assert res_connect.status_code == 200
    conn_data = res_connect.json()
    assert conn_data["success"] is True
    assert conn_data["doctor"]["doctor_name"] == "Dr. Tahmid Rahman"
    assert "patient_id_code" in conn_data["doctor"]

    # Verify doctor patients endpoint returns linked patients
    res_pats = client.get("/api/doctor/patients", headers=headers)
    assert res_pats.status_code == 200
    pats_data = res_pats.json()
    assert "patients" in pats_data
    assert len(pats_data["patients"]) >= 1
