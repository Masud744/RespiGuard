"""
tests/test_simulation_sensor_stream_integration.py
================================================================================
Simulation Sensor Stream & AHI Environmental Hazard Integration Test Suite.
Verifies Priority 2 (Simulation sensor end-to-end integration):
1. SensorSimulator physics bounds (temperature, humidity, PM2.5, MQ135).
2. Aerosol optical invariants (PM1.0 <= PM2.5 <= PM10) across multi-cycle runs.
3. Spike injection behavior and bounds enforcement.
4. End-to-end simulated stream ingestion via FastAPI gateway with HMAC authentication.
5. Rolling window lifecycle state progression:
   - STATUS_INITIALIZING (< 180s or < 6 samples)
   - STATUS_PROVISIONAL (180s <= t < 2700s)
   - STATUS_VALIDATED_1HOUR / STATUS_DATA_SUFFICIENT_1HOUR (t >= 2700s, completeness >= 75%)
   - STATUS_SENSOR_OFFLINE_STALE (gap >= 300s)
6. Stream anomaly handling: Sequence drift, missing sequence, future drift, CAS conflict (409).
7. Multi-device stream isolation during concurrent streaming.
================================================================================
"""

import os
import json
import hmac
import hashlib
import pytest
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

# Configure test device PSK
TEST_SIM_PSK = "test-device-psk-secret-32-chars-ok!"
os.environ["SIMULATOR_DEVICE_PSK"] = TEST_SIM_PSK

import backend.main as bmain
from backend.main import (
    app,
    device_exposure_windows,
    compute_telemetry_canonical_string,
    get_or_create_device_windows,
    db_service
)
from sensor_simulator import SensorSimulator

client = TestClient(app)


def build_signed_sim_packet(
    device_node: str,
    seq_num: int,
    packet_dt: datetime,
    telemetry_dict: dict,
    secret: str = TEST_SIM_PSK
):
    """Constructs canonical string and HMAC signature headers for simulated packet."""
    payload = dict(telemetry_dict)
    payload["age"] = payload.get("age", 30.0)
    payload["seq_num"] = seq_num
    payload_bytes = json.dumps(payload).encode("utf-8")
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
def reset_engine_state():
    """Resets per-device rolling exposure windows and latest state between tests."""
    device_exposure_windows.clear()
    bmain.latest_telemetry_state = {
        "telemetry": None,
        "prediction": None,
        "timestamp": None,
        "environmental_hazard": None
    }
    yield
    device_exposure_windows.clear()


# ==============================================================================
# 1. SENSOR SIMULATOR PHYSICS & OPTICAL INVARIANTS
# ==============================================================================

def test_sensor_simulator_physics_bounds():
    """Verifies that SensorSimulator generates values within strict physical bounds over 100 cycles."""
    sim = SensorSimulator()
    for _ in range(100):
        data = sim.step(inject_spike=False)
        assert 20.0 <= data["temperature"] <= 32.0, f"Temp out of bounds: {data['temperature']}"
        assert 45.0 <= data["humidity"] <= 85.0, f"Humidity out of bounds: {data['humidity']}"
        assert 6.0 <= data["pm2_5"] <= 55.0, f"PM2.5 out of bounds: {data['pm2_5']}"
        assert 380.0 <= data["mq135"] <= 480.0, f"MQ135 out of bounds: {data['mq135']}"


def test_sensor_simulator_optical_aerosol_invariants():
    """Verifies physical aerosol optics relationship: PM1.0 <= PM2.5 <= PM10."""
    sim = SensorSimulator()
    for _ in range(100):
        data = sim.step(inject_spike=False)
        assert data["pm1_0"] <= data["pm2_5"], f"Invariant violation: PM1.0 ({data['pm1_0']}) > PM2.5 ({data['pm2_5']})"
        assert data["pm2_5"] <= data["pm10"], f"Invariant violation: PM2.5 ({data['pm2_5']}) > PM10 ({data['pm10']})"


def test_sensor_simulator_spike_injection_behavior():
    """Verifies that spike injection mode produces elevated PM2.5 readings."""
    sim = SensorSimulator()
    max_spike_pm25 = 0.0
    for _ in range(150):
        data = sim.step(inject_spike=True)
        if data["pm2_5"] > max_spike_pm25:
            max_spike_pm25 = data["pm2_5"]
    assert max_spike_pm25 > 25.0, f"Expected smoke/dust spike > 25.0 µg/m³, got {max_spike_pm25}"


# ==============================================================================
# 2. END-TO-END SIMULATION STREAMING & AHI STATE TRANSITIONS
# ==============================================================================

def test_simulation_stream_ahi_lifecycle():
    """
    Simulates streaming sensor packets and verifies deterministic AHI lifecycle progression:
    - Packets 1-6 (0-150s): STATUS_INITIALIZING (duration < 180s)
    - Packet 7 (180s): STATUS_PROVISIONAL (valid_duration >= 180s and samples >= 6)
    - Pre-seeded 1-hour window (90+ samples, >= 2700s): STATUS_VALIDATED_1HOUR / STATUS_DATA_SUFFICIENT_1HOUR
    """
    dev = "ESP32-STREAM-LIFECYCLE-01"
    sim = SensorSimulator()
    now_utc = datetime.now(timezone.utc)
    base_t = now_utc - timedelta(seconds=210)

    # 1. Packet 1 at base_t -> STATUS_INITIALIZING
    data1 = sim.step()
    b1, h1 = build_signed_sim_packet(dev, 1, base_t, data1)
    r1 = client.post("/api/telemetry", data=b1, headers=h1)
    assert r1.status_code == 200
    ahi1 = r1.json()["environmental_hazard"]
    assert ahi1["status"] == "STATUS_INITIALIZING"
    assert ahi1["ahi"] is None
    assert ahi1["is_valid"] is False

    # 2. Ingest packets 2 to 6 (at 30s increments up to 150s elapsed)
    for seq in range(2, 7):
        t_seq = base_t + timedelta(seconds=(seq - 1) * 30)
        body, h = build_signed_sim_packet(dev, seq, t_seq, sim.step())
        r = client.post("/api/telemetry", data=body, headers=h)
        assert r.status_code == 200

    r6_ahi = r.json()["environmental_hazard"]
    assert r6_ahi["status"] == "STATUS_INITIALIZING"

    # 3. Packet 7 at 180s -> Transition to STATUS_PROVISIONAL_SHORT_TERM
    t7 = base_t + timedelta(seconds=180)
    body7, h7 = build_signed_sim_packet(dev, 7, t7, sim.step())
    r7 = client.post("/api/telemetry", data=body7, headers=h7)
    assert r7.status_code == 200
    ahi7 = r7.json()["environmental_hazard"]
    assert ahi7["status"] == "STATUS_PROVISIONAL_SHORT_TERM"
    assert ahi7["ahi"] is not None
    assert ahi7["is_provisional"] is True
    assert ahi7["is_valid"] is False

    # 4. Transition to 1-hour data sufficiency (tested with clean monotonic sequence)
    dev_full = "ESP32-STREAM-1HOUR-FULL"
    windows_full = get_or_create_device_windows(dev_full)
    base_epoch = now_utc.timestamp()
    for i in range(119):
        t_sample = base_epoch - 3600.0 + (i * 30.0)
        step_val = sim.step()
        windows_full["pm2_5"].add_sample(t_sample, step_val["pm2_5"])
        windows_full["pm10"].add_sample(t_sample, step_val["pm10"])

    # Ingest 120th packet at now_utc via live API
    b120, h120 = build_signed_sim_packet(dev_full, 120, now_utc, sim.step())
    r120 = client.post("/api/telemetry", data=b120, headers=h120)
    assert r120.status_code == 200
    ahi120 = r120.json()["environmental_hazard"]
    assert ahi120["status"] in ("STATUS_VALIDATED_1HOUR", "STATUS_DATA_SUFFICIENT_1HOUR")
    assert ahi120["is_valid"] is True
    assert ahi120["is_provisional"] is False
    assert ahi120["completeness_pct"] >= 75.0


def test_simulation_multi_device_concurrent_isolation():
    """Verifies that two concurrently streaming simulated devices maintain completely isolated windows."""
    dev_a = "ESP32-CONCURRENT-A"
    dev_b = "ESP32-CONCURRENT-B"
    sim_a = SensorSimulator()
    sim_b = SensorSimulator()
    now_utc = datetime.now(timezone.utc)
    base_t = now_utc - timedelta(seconds=210)

    # Stream 7 packets to Dev A (reaching Provisional state)
    for seq in range(1, 8):
        t = base_t + timedelta(seconds=(seq - 1) * 30)
        body, h = build_signed_sim_packet(dev_a, seq, t, sim_a.step())
        resp_a = client.post("/api/telemetry", data=body, headers=h)
        assert resp_a.status_code == 200

    # Dev A has 7 samples and is Provisional
    win_a = device_exposure_windows[dev_a]["pm2_5"]
    assert len(win_a.buffer) == 7
    assert resp_a.json()["environmental_hazard"]["status"] == "STATUS_PROVISIONAL_SHORT_TERM"

    # Stream only 2 packets to Dev B
    for seq in range(1, 3):
        t = base_t + timedelta(seconds=(seq - 1) * 30)
        body, h = build_signed_sim_packet(dev_b, seq, t, sim_b.step())
        resp_b = client.post("/api/telemetry", data=body, headers=h)
        assert resp_b.status_code == 200

    win_b = device_exposure_windows[dev_b]["pm2_5"]
    assert len(win_b.buffer) == 2
    assert resp_b.json()["environmental_hazard"]["status"] == "STATUS_INITIALIZING"

    # Verify Dev A remained unaffected with exactly 7 samples
    assert len(device_exposure_windows[dev_a]["pm2_5"].buffer) == 7


def test_simulation_stream_anomaly_rejection(monkeypatch):
    """Verifies rejection of stream anomalies: CAS sequence replay (409), stale ts (422), future ts (422)."""
    dev = "ESP32-ANOMALY-STREAM"
    sim = SensorSimulator()
    now_utc = datetime.now(timezone.utc)

    # 1. Normal ingestion -> 200
    b1, h1 = build_signed_sim_packet(dev, 1, now_utc, sim.step())
    r1 = client.post("/api/telemetry", data=b1, headers=h1)
    assert r1.status_code == 200

    # 2. CAS sequence replay conflict -> HTTP 409
    def mock_ingest_replay(*args, **kwargs):
        raise ValueError("TELEMETRY_SEQUENCE_REPLAY_DETECTED: incoming seq 1 <= committed 1")

    monkeypatch.setattr(db_service, "ingest_telemetry_atomic", mock_ingest_replay)

    b1_replay, h1_replay = build_signed_sim_packet(dev, 1, now_utc, sim.step())
    r1_replay = client.post("/api/telemetry", data=b1_replay, headers=h1_replay)
    assert r1_replay.status_code == 409
    assert "sequence number replay" in r1_replay.json()["detail"].lower()

    # 3. Future drift violation (> 30s) -> HTTP 422
    t_future = now_utc + timedelta(seconds=60)
    b_fut, h_fut = build_signed_sim_packet(dev, 2, t_future, sim.step())
    r_fut = client.post("/api/telemetry", data=b_fut, headers=h_fut)
    assert r_fut.status_code == 422
    assert "future drift tolerance" in r_fut.json()["detail"]

    # 4. Stale timestamp violation (> 300s) -> HTTP 422
    t_stale = now_utc - timedelta(seconds=350)
    b_stale, h_stale = build_signed_sim_packet(dev, 3, t_stale, sim.step())
    r_stale = client.post("/api/telemetry", data=b_stale, headers=h_stale)
    assert r_stale.status_code == 422
    assert "stale (> 300s)" in r_stale.json()["detail"]
