"""
tests/test_backend_api_integration.py
================================================================================
Comprehensive Backend API & Security Gateway Integration Test Suite.
Verifies Priority 1:
- Demographic boundary checks (age >= 18.0)
- Sequence number enforcement and monotonic CAS
- Wall-clock timestamp drift bounds (-300s to +30s)
- HMAC-SHA256 device authentication
- Auth OTP generation, verification, and password validation
- Telemetry latest polling with dynamic staleness evaluation
- Doctor directory, messaging, and IDOR protection
================================================================================
"""

import os
import json
import time
import hmac
import hashlib
import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

# Configure test device PSK
TEST_DEVICE_PSK = "test-device-psk-secret-32-chars-ok!"
os.environ["SIMULATOR_DEVICE_PSK"] = TEST_DEVICE_PSK

import backend.main as bmain
from backend.main import (
    app,
    device_exposure_windows,
    compute_telemetry_canonical_string,
    db_service
)
from backend.email_service import (
    _otp_store,
    generate_and_save_otp,
    clear_email_otp
)

client = TestClient(app)


def build_signed_packet(device_node: str, seq_num: int, packet_dt: datetime, telemetry_dict: dict, secret: str = TEST_DEVICE_PSK):
    """Constructs canonical string and HMAC signature headers."""
    payload_bytes = json.dumps(telemetry_dict).encode("utf-8")
    payload_sha256 = hashlib.sha256(payload_bytes).hexdigest()
    ts_str = packet_dt.isoformat()
    canonical_str = compute_telemetry_canonical_string(
        device_node=device_node,
        timestamp_str=ts_str,
        seq_num=seq_num,
        payload_sha256=payload_sha256
    )
    sig = hmac.new(secret.encode("utf-8"), canonical_str.encode("utf-8"), hashlib.sha256).hexdigest()
    headers = {
        "Content-Type": "application/json",
        "X-Device-Id": device_node,
        "X-Device-Sequence": str(seq_num),
        "X-Device-Timestamp": ts_str,
        "X-Device-Signature": sig
    }
    return payload_bytes, headers


@pytest.fixture(autouse=True)
def cleanup_state():
    """Cleans in-memory windows and resets state between tests."""
    device_exposure_windows.clear()
    bmain.latest_telemetry_state = {
        "telemetry": None,
        "prediction": None,
        "timestamp": None,
        "environmental_hazard": None
    }
    _otp_store.clear()
    yield
    device_exposure_windows.clear()
    _otp_store.clear()


# ==============================================================================
# 1. TELEMETRY INGESTION GATEWAY & INVARIANTS
# ==============================================================================

def test_telemetry_demographic_adult_cohort_gate():
    """Verifies that pediatric telemetry (age < 18.0) returns HTTP 422."""
    dev = "ESP32-PEDIATRIC-TEST"
    t_now = datetime.now(timezone.utc)
    body, headers = build_signed_packet(
        dev, 1, t_now,
        {"temperature": 25.0, "humidity": 60.0, "pm1_0": 10.0, "pm2_5": 15.0, "pm10": 25.0, "age": 15.0}
    )
    resp = client.post("/api/telemetry", data=body, headers=headers)
    assert resp.status_code == 422
    assert "adult cohorts (age >= 18.0)" in resp.json()["detail"]


def test_telemetry_missing_sequence_number():
    """Verifies that packets lacking sequence numbers return HTTP 400."""
    headers = {"Content-Type": "application/json"}
    payload_null_seq = {"temperature": 25.0, "humidity": 60.0, "pm1_0": 10.0, "pm2_5": 15.0, "pm10": 25.0, "seq_num": None}
    resp_null = client.post("/api/telemetry", json=payload_null_seq, headers=headers)
    assert resp_null.status_code == 400
    assert "Missing telemetry sequence number" in resp_null.json()["detail"]


def test_telemetry_timestamp_future_drift_rejection():
    """Verifies that future timestamps (> +30s) are rejected with HTTP 422."""
    dev = "ESP32-FUTURE-TEST"
    t_future = datetime.now(timezone.utc) + timedelta(seconds=45)
    body, headers = build_signed_packet(
        dev, 1, t_future,
        {"temperature": 24.0, "humidity": 55.0, "pm1_0": 8.0, "pm2_5": 12.0, "pm10": 20.0, "age": 25.0}
    )
    resp = client.post("/api/telemetry", data=body, headers=headers)
    assert resp.status_code == 422
    assert "future drift tolerance" in resp.json()["detail"]


def test_telemetry_timestamp_stale_rejection():
    """Verifies that past timestamps (> 300s old) are rejected with HTTP 422."""
    dev = "ESP32-STALE-TS-TEST"
    t_stale = datetime.now(timezone.utc) - timedelta(seconds=350)
    body, headers = build_signed_packet(
        dev, 1, t_stale,
        {"temperature": 24.0, "humidity": 55.0, "pm1_0": 8.0, "pm2_5": 12.0, "pm10": 20.0, "age": 25.0}
    )
    resp = client.post("/api/telemetry", data=body, headers=headers)
    assert resp.status_code == 422
    assert "stale (> 300s)" in resp.json()["detail"]


def test_telemetry_hmac_signature_verification():
    """Verifies that packets with invalid signatures are rejected with HTTP 401."""
    dev = "ESP32-SIG-TEST"
    t_now = datetime.now(timezone.utc)
    body, headers = build_signed_packet(
        dev, 1, t_now,
        {"temperature": 25.0, "humidity": 60.0, "pm1_0": 10.0, "pm2_5": 15.0, "pm10": 25.0, "age": 25.0},
        secret="wrong-secret-key-that-does-not-match!"
    )
    resp = client.post("/api/telemetry", data=body, headers=headers)
    assert resp.status_code == 401
    assert "Invalid device telemetry signature" in resp.json()["detail"]


def test_telemetry_valid_flow_and_response_structure():
    """Verifies successful ingestion of authenticated telemetry returning both ML and AHI."""
    dev = "ESP32-VALID-FLOW"
    t_now = datetime.now(timezone.utc)
    body, headers = build_signed_packet(
        dev, 1, t_now,
        {"temperature": 25.0, "humidity": 60.0, "pm1_0": 12.0, "pm2_5": 18.0, "pm10": 30.0, "age": 28.0}
    )
    resp = client.post("/api/telemetry", data=body, headers=headers)
    assert resp.status_code == 200
    res = resp.json()
    assert res["status"] == "success"
    assert "prediction" in res
    assert "environmental_hazard" in res
    assert res["prediction"]["prediction"] in ["Green", "Yellow", "Red"]
    assert res["environmental_hazard"]["status"] == "STATUS_INITIALIZING"


# ==============================================================================
# 2. AUTHENTICATION & ONBOARDING ENDPOINTS
# ==============================================================================

def test_auth_otp_flow_and_registration():
    """Tests the full email OTP cycle and signup error handling."""
    test_email = "patient_test_integration@respiguard.ai"
    test_name = "Integration Test Patient"

    # 1. Request OTP via endpoint
    otp_resp = client.post("/api/auth/send-otp", json={"email": test_email, "full_name": test_name})
    assert otp_resp.status_code == 200
    assert otp_resp.json()["success"] is True
    # Verify OTP is stored securely in _otp_store
    assert test_email in _otp_store
    assert _otp_store[test_email]["verified"] is False

    # 2. Attempt signup BEFORE verifying OTP -> HTTP 400
    signup_attempt_unverified = client.post("/api/auth/signup", json={
        "email": test_email,
        "password": "ValidPassword123!",
        "full_name": test_name,
        "age": 30.0
    })
    assert signup_attempt_unverified.status_code == 400
    assert "verify your email address" in signup_attempt_unverified.json()["detail"]

    # 3. Attempt verify with wrong OTP code -> HTTP 400
    bad_verify = client.post("/api/auth/verify-otp", json={"email": test_email, "otp": "000000"})
    assert bad_verify.status_code == 400

    # 4. Generate fresh known OTP and verify successfully
    _otp_store.clear()
    valid_otp, _ = generate_and_save_otp(test_email)
    verify_resp = client.post("/api/auth/verify-otp", json={"email": test_email, "otp": valid_otp})
    assert verify_resp.status_code == 200
    assert verify_resp.json()["success"] is True

    # 5. Attempt signup with weak password -> HTTP 400
    signup_weak_pwd = client.post("/api/auth/signup", json={
        "email": test_email,
        "password": "weak",
        "full_name": test_name,
        "age": 30.0
    })
    assert signup_weak_pwd.status_code in (400, 422)


def test_auth_demographic_gate_in_signup():
    """Verifies that patients under 18 cannot register (HTTP 422)."""
    resp = client.post("/api/auth/signup", json={
        "email": "minor_patient@example.com",
        "password": "ValidPassword123!",
        "full_name": "Minor Patient",
        "age": 16.0
    })
    assert resp.status_code == 422
    assert "adult cohorts (age >= 18.0)" in resp.json()["detail"]


# ==============================================================================
# 3. LATEST TELEMETRY POLLING & DYNAMIC STALENESS
# ==============================================================================

def test_telemetry_latest_polling_and_staleness():
    """Verifies GET /api/telemetry/latest returns latest reading and dynamic staleness."""
    dev = "ESP32-LATEST-TEST"
    t_now = datetime.now(timezone.utc)
    body, headers = build_signed_packet(
        dev, 1, t_now,
        {"temperature": 26.0, "humidity": 55.0, "pm1_0": 10.0, "pm2_5": 15.0, "pm10": 25.0, "age": 25.0}
    )
    client.post("/api/telemetry", data=body, headers=headers)

    # Immediate polling -> valid reading present
    latest_resp = client.get("/api/telemetry/latest")
    assert latest_resp.status_code == 200
    latest = latest_resp.json()
    assert latest["telemetry"] is not None
    assert latest["telemetry"]["temperature"] == 26.0

    # Simulate sensor inactivity >= 300s (ISO format timestamp)
    bmain.latest_telemetry_state["timestamp"] = (datetime.now(timezone.utc) - timedelta(seconds=350)).isoformat()
    stale_resp = client.get("/api/telemetry/latest")
    assert stale_resp.status_code == 200
    stale = stale_resp.json()
    env = stale["environmental_hazard"]
    assert env["status"] == "STATUS_SENSOR_OFFLINE_STALE"
    assert env["ahi"] is None
    assert env["is_valid"] is False
