"""
Integration Test Suite: FastAPI Environmental Hazard & Metrology Engine Integration
Module: tests/test_fastapi_environmental_integration.py
Target Under Test: backend/main.py (/api/telemetry and /api/telemetry/latest)

Verifies:
1. Telemetry Ingestion Flow & Legacy API Compatibility:
   - Preserves existing keys: status, message, reading_id, seq_num, prediction.
   - Incorporates environmental_hazard metadata block without disruption.
2. Metrology Computation Execution Point:
   - Runs strictly AFTER cryptographic authentication and database persistence.
   - Failed authentication (HTTP 401) or sequence replay (HTTP 409) does not mutate rolling windows.
3. Multi-Device Window Isolation:
   - Independent per-device rolling windows for distinct device nodes.
   - Proves zero state contamination or sample leakage across devices.
4. State Transitions & Lifecycle:
   - Initializing (< 180s or < 6 samples): returns ahi=None, STATUS_INITIALIZING, is_valid=False.
   - Provisional (180s - 2699s): interim weighted average, STATUS_PROVISIONAL_SHORT_TERM, is_valid=False.
   - Data-Sufficient (>= 2700s, >= 75%): 1-Hour Data-Sufficient AHI, STATUS_VALIDATED_1HOUR, is_valid=True.
   - Stale Data (>= 300s): dynamically returns STATUS_SENSOR_OFFLINE_STALE, ahi=None, is_valid=False on GET /api/telemetry/latest.
5. Scientific & Regulatory Neutrality:
   - Zero clinical diagnoses or medical prescription directives in advisories.
   - Zero claims of statutory EPA AQI regulatory compliance.
"""

import os
import sys
import json
import time
import hmac
import hashlib
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient

# Ensure workspace root is on sys.path
WORKSPACE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if WORKSPACE_ROOT not in sys.path:
    sys.path.insert(0, WORKSPACE_ROOT)

# Configure test environment
TEST_DEVICE_PSK = "test-device-psk-secret-32-chars-ok!"
os.environ["SIMULATOR_DEVICE_PSK"] = TEST_DEVICE_PSK

import backend.main as bmain
from backend.main import (
    app,
    device_exposure_windows,
    compute_telemetry_canonical_string,
    db_service,
    get_or_create_device_windows,
)

client = TestClient(app)


def build_signed_packet(device_node: str, seq_num: int, packet_dt: datetime, telemetry_dict: dict, secret: str = TEST_DEVICE_PSK):
    """Constructs valid JSON body and HMAC-SHA256 headers for /api/telemetry."""
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
def clean_device_windows():
    """Resets in-memory device exposure windows and state before every test."""
    device_exposure_windows.clear()
    bmain.latest_telemetry_state = {
        "telemetry": None,
        "prediction": None,
        "timestamp": None,
        "environmental_hazard": None
    }
    yield
    device_exposure_windows.clear()


# =============================================================================
# 1. TELEMETRY FLOW & RESPONSE COMPATIBILITY TESTS
# =============================================================================

def test_telemetry_flow_response_compatibility():
    """
    Verifies that POST /api/telemetry returns all legacy keys and incorporates
    the environmental_hazard block with correct schema types.
    """
    device_node = "ESP32-COMPAT-01"
    now_utc = datetime.now(timezone.utc)
    telemetry_data = {
        "temperature": 24.5,
        "humidity": 55.0,
        "pm1_0": 8.0,
        "pm2_5": 14.0,
        "pm10": 22.0,
        "mq135": 410.0,
        "device_node": device_node,
        "seq_num": 1,
        "age": 25.0
    }

    body, headers = build_signed_packet(device_node, 1, now_utc, telemetry_data)
    response = client.post("/api/telemetry", data=body, headers=headers)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

    res = response.json()

    # 1. Check all legacy keys are strictly preserved
    assert res["status"] == "success"
    assert "message" in res
    assert "reading_id" in res
    assert res["seq_num"] == 1
    assert "prediction" in res
    assert isinstance(res["prediction"], dict)

    # 2. Check environmental_hazard metadata block
    assert "environmental_hazard" in res
    env = res["environmental_hazard"]
    assert "ahi" in env
    assert "category" in env
    assert "status" in env
    assert "is_valid" in env
    assert "is_provisional" in env
    assert "completeness_pct" in env
    assert "valid_duration_seconds" in env
    assert "pm25_subindex" in env
    assert "pm10_subindex" in env
    assert "heat_index_c" in env
    assert "heat_index_f" in env
    assert "thermal_multiplier" in env
    assert "advisory" in env


# =============================================================================
# 2. METROLOGY COMPUTATION EXECUTION POINT & AUTHENTICATION GATING
# =============================================================================

def test_unauthenticated_packet_does_not_mutate_windows():
    """
    Verifies that unauthenticated telemetry packets (bad HMAC signature)
    fail with HTTP 401 and DO NOT trigger metrology window mutation.
    """
    device_node = "ESP32-GATE-AUTH-01"
    now_utc = datetime.now(timezone.utc)
    telemetry_data = {
        "temperature": 25.0,
        "humidity": 50.0,
        "pm1_0": 10.0,
        "pm2_5": 20.0,
        "pm10": 30.0,
        "device_node": device_node,
        "seq_num": 10,
        "age": 30.0
    }

    body, headers = build_signed_packet(device_node, 10, now_utc, telemetry_data, secret="WRONG_SECRET_KEY")
    response = client.post("/api/telemetry", data=body, headers=headers)
    assert response.status_code == 401, f"Expected 401, got {response.status_code}"

    # Window for this device must NOT exist or have zero samples
    assert device_node not in device_exposure_windows


def test_cas_conflict_does_not_mutate_windows(monkeypatch):
    """
    Verifies that if atomic database persistence fails (e.g. sequence replay 409),
    the AHI computation is NOT executed and rolling window is not updated.
    """
    device_node = "ESP32-GATE-CAS-01"
    now_utc = datetime.now(timezone.utc)
    telemetry_data = {
        "temperature": 25.0,
        "humidity": 50.0,
        "pm1_0": 10.0,
        "pm2_5": 20.0,
        "pm10": 30.0,
        "device_node": device_node,
        "seq_num": 5,
        "age": 30.0
    }

    # Simulate database atomic CAS rejection (sequence replay)
    def mock_ingest_replay(*args, **kwargs):
        raise ValueError("TELEMETRY_SEQUENCE_REPLAY_DETECTED: incoming seq 5 <= committed 5")

    monkeypatch.setattr(db_service, "ingest_telemetry_atomic", mock_ingest_replay)

    body, headers = build_signed_packet(device_node, 5, now_utc, telemetry_data)
    response = client.post("/api/telemetry", data=body, headers=headers)
    assert response.status_code == 409, f"Expected 409, got {response.status_code}"

    # Rolling window must NOT have been populated because db persistence failed
    assert device_node not in device_exposure_windows


# =============================================================================
# 3. MULTI-DEVICE ROLLING WINDOW ISOLATION
# =============================================================================

def test_multi_device_window_isolation():
    """
    Verifies that separate devices maintain strictly isolated rolling windows.
    Telemetry from Device-Alpha does not contaminate Device-Beta.
    """
    dev_a = "ESP32-NODE-ALPHA"
    dev_b = "ESP32-NODE-BETA"
    now_utc = datetime.now(timezone.utc)
    base_epoch = now_utc.timestamp()

    # Pre-seed Device-A's windows with 119 samples of clean air (PM2.5=5.0, PM10=10.0)
    win_a = get_or_create_device_windows(dev_a)
    for i in range(119):
        t_sample = base_epoch - 3600.0 + (i * 30.0)
        win_a["pm2_5"].add_sample(t_sample, 5.0)
        win_a["pm10"].add_sample(t_sample, 10.0)

    # Ingest the 120th packet for Device-A via live POST /api/telemetry at now_utc
    body_a, headers_a = build_signed_packet(
        dev_a, 120, now_utc,
        {"temperature": 22.0, "humidity": 50.0, "pm1_0": 2.0, "pm2_5": 5.0, "pm10": 10.0, "age": 28.0}
    )
    resp_a = client.post("/api/telemetry", data=body_a, headers=headers_a)
    assert resp_a.status_code == 200

    # Device-A should have 1-Hour Data-Sufficient status (120 samples) and Low Hazard
    res_a = resp_a.json()["environmental_hazard"]
    assert res_a["status"] == "STATUS_VALIDATED_1HOUR"
    assert res_a["is_valid"] is True
    assert res_a["category"] == "Low Environmental Hazard"

    # Now ingest 1 sample for Device-B: High particulate (PM2.5=160.0, PM10=220.0)
    body_b, headers_b = build_signed_packet(
        dev_b, 1, now_utc,
        {"temperature": 30.0, "humidity": 65.0, "pm1_0": 100.0, "pm2_5": 160.0, "pm10": 220.0, "age": 35.0}
    )
    resp_b = client.post("/api/telemetry", data=body_b, headers=headers_b)
    assert resp_b.status_code == 200

    res_b = resp_b.json()["environmental_hazard"]

    # Device-B must be in INITIALIZING state (1 sample), completely isolated from Device-A
    assert res_b["status"] == "STATUS_INITIALIZING"
    assert res_b["ahi"] is None
    assert res_b["is_valid"] is False
    assert res_b["is_provisional"] is True

    # Confirm Device-A's window in memory has 120 samples and Device-B has 1 sample
    win_a_final = device_exposure_windows[dev_a]["pm2_5"]
    win_b_final = device_exposure_windows[dev_b]["pm2_5"]
    assert len(win_a_final.buffer) == 120
    assert len(win_b_final.buffer) == 1


# =============================================================================
# 4. STATE PROGRESSION & STALE-SENSOR POLICIES
# =============================================================================

def test_initializing_state_policy():
    """
    Verifies that when buffer has < 180s or < 6 samples:
    - ahi is None (no instantaneous reading masqueraded as 1-hour AHI)
    - status is STATUS_INITIALIZING
    - is_valid is False, is_provisional is True
    """
    dev = "ESP32-INIT-TEST"
    t_now = datetime.now(timezone.utc)
    body, headers = build_signed_packet(
        dev, 1, t_now,
        {"temperature": 23.0, "humidity": 50.0, "pm1_0": 5.0, "pm2_5": 12.0, "pm10": 20.0, "age": 22.0}
    )
    resp = client.post("/api/telemetry", data=body, headers=headers)
    assert resp.status_code == 200

    env = resp.json()["environmental_hazard"]
    assert env["status"] == "STATUS_INITIALIZING"
    assert env["ahi"] is None
    assert env["is_valid"] is False
    assert env["is_provisional"] is True
    assert "Initializing" in env["category"]
    assert "initializing" in env["advisory"].lower()


def test_provisional_state_policy():
    """
    Verifies that when buffer has >= 180s but < 2700s:
    - ahi is calculated from interim weighted average
    - status is STATUS_PROVISIONAL_SHORT_TERM
    - is_valid is False, is_provisional is True
    - advisory disclaims that it is a provisional estimate not equivalent to 1-hour rolling AHI
    """
    dev = "ESP32-PROV-TEST"
    now_utc = datetime.now(timezone.utc)
    base_epoch = now_utc.timestamp()

    # Pre-seed 14 samples (@ 30s intervals = 420s of history)
    win = get_or_create_device_windows(dev)
    for i in range(14):
        t_sample = base_epoch - 450.0 + (i * 30.0)
        win["pm2_5"].add_sample(t_sample, 20.0)
        win["pm10"].add_sample(t_sample, 30.0)

    # Ingest 15th sample at now_utc via live API
    body, headers = build_signed_packet(
        dev, 15, now_utc,
        {"temperature": 25.0, "humidity": 50.0, "pm1_0": 10.0, "pm2_5": 20.0, "pm10": 30.0, "age": 25.0}
    )
    resp = client.post("/api/telemetry", data=body, headers=headers)
    assert resp.status_code == 200

    env = resp.json()["environmental_hazard"]
    assert env["status"] == "STATUS_PROVISIONAL_SHORT_TERM"
    assert isinstance(env["ahi"], int)
    assert env["is_valid"] is False
    assert env["is_provisional"] is True
    assert "provisional" in env["advisory"].lower()
    assert "not equivalent to a 1-hour rolling ahi" in env["advisory"].lower()


def test_data_sufficient_state_policy():
    """
    Verifies that when buffer has >= 2700s (75% of 1 hour):
    - status is STATUS_VALIDATED_1HOUR (1-Hour Data-Sufficient AHI)
    - is_valid is True, is_provisional is False
    - completeness_pct >= 75
    """
    dev = "ESP32-SUFFICIENT-TEST"
    now_utc = datetime.now(timezone.utc)
    base_epoch = now_utc.timestamp()

    # Pre-seed 94 samples (@ 30s intervals = 2820s of history)
    win = get_or_create_device_windows(dev)
    for i in range(94):
        t_sample = base_epoch - 2850.0 + (i * 30.0)
        win["pm2_5"].add_sample(t_sample, 30.0)
        win["pm10"].add_sample(t_sample, 50.0)

    # Ingest 95th sample at now_utc via live API
    body, headers = build_signed_packet(
        dev, 95, now_utc,
        {"temperature": 25.0, "humidity": 50.0, "pm1_0": 10.0, "pm2_5": 30.0, "pm10": 50.0, "age": 25.0}
    )
    resp = client.post("/api/telemetry", data=body, headers=headers)
    assert resp.status_code == 200

    env = resp.json()["environmental_hazard"]
    assert env["status"] == "STATUS_VALIDATED_1HOUR"
    assert isinstance(env["ahi"], int)
    assert env["is_valid"] is True
    assert env["is_provisional"] is False
    assert env["completeness_pct"] >= 75
    assert "1-hour data-sufficient exposure" in env["advisory"].lower()


def test_stale_sensor_on_latest_polling():
    """
    Verifies that GET /api/telemetry/latest dynamically transitions to
    STATUS_SENSOR_OFFLINE_STALE with ahi=None when >= 300s has elapsed since last sample.
    """
    dev = "ESP32-STALE-TEST"
    now_utc = datetime.now(timezone.utc)
    body, headers = build_signed_packet(
        dev, 1, now_utc,
        {"temperature": 25.0, "humidity": 50.0, "pm1_0": 10.0, "pm2_5": 20.0, "pm10": 30.0, "age": 25.0}
    )
    resp = client.post("/api/telemetry", data=body, headers=headers)
    assert resp.status_code == 200

    # Simulate passage of 310 seconds on the backend's latest telemetry state
    past_timestamp = (now_utc - timedelta(seconds=310)).isoformat()
    bmain.latest_telemetry_state["timestamp"] = past_timestamp

    # Query GET /api/telemetry/latest
    latest_resp = client.get("/api/telemetry/latest")
    assert latest_resp.status_code == 200
    latest_data = latest_resp.json()

    env = latest_data["environmental_hazard"]
    assert env["status"] == "STATUS_SENSOR_OFFLINE_STALE"
    assert env["ahi"] is None
    assert env["is_valid"] is False
    assert env["is_provisional"] is True
    assert env["category"] == "Sensor Offline / Stale Data"
    assert "stale or connection interrupted" in env["advisory"]


# =============================================================================
# 5. SCIENTIFIC & REGULATORY NEUTRALITY
# =============================================================================

def test_neutrality_and_absence_of_clinical_claims():
    """
    Verifies that environmental hazard outputs never claim clinical diagnosis,
    medical treatment directives, or official EPA AQI compliance.
    """
    dev = "ESP32-NEUTRAL-TEST"
    t_now = datetime.now(timezone.utc)
    body, headers = build_signed_packet(
        dev, 1, t_now,
        {"temperature": 25.0, "humidity": 50.0, "pm1_0": 50.0, "pm2_5": 80.0, "pm10": 150.0, "age": 30.0}
    )
    resp = client.post("/api/telemetry", data=body, headers=headers)
    assert resp.status_code == 200

    env = resp.json()["environmental_hazard"]
    category = env["category"]
    advisory = env["advisory"]

    # Prohibited clinical claims
    forbidden_terms = [
        "clinical diagnosis", "medical treatment", "prescribe inhaler", "asthma attack guaranteed",
        "official epa aqi", "statutory compliance", "attainment non-attainment"
    ]
    for term in forbidden_terms:
        assert term not in category.lower(), f"Forbidden term '{term}' found in category: {category}"
        assert term not in advisory.lower(), f"Forbidden term '{term}' found in advisory: {advisory}"

    # Category must belong to approved neutral tiers
    approved_categories = [
        "Initializing (Insufficient History)",
        "Low Environmental Hazard",
        "Moderate Environmental Hazard",
        "Elevated Environmental Hazard",
        "High Environmental Hazard",
        "Critical Environmental Hazard",
        "Sensor Offline / Stale Data"
    ]
    assert category in approved_categories, f"Unapproved category tier: {category}"
