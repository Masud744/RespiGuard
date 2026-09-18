import pytest
from fastapi.testclient import TestClient
import sys
import os

from backend.main import app
from backend.agent_service import RespiGuardAgentService, COPILOT_TOOLS
from backend.db_service import db_service

@pytest.fixture
def client():
    return TestClient(app)

def test_copilot_tools_schema_definition():
    """Validates that all 7 OpenAI/Groq function tools are properly defined."""
    tool_names = [t["function"]["name"] for t in COPILOT_TOOLS]
    expected_tools = [
        "get_live_telemetry_and_sensors",
        "get_outdoor_and_open_meteo_air_quality",
        "get_xai_clinical_risk_and_shap",
        "get_medications_and_schedule",
        "log_medication_dose",
        "search_doctors_directory",
        "send_message_to_doctor",
        "get_air_quality_map_and_emergency_facilities"
    ]
    for exp in expected_tools:
        assert exp in tool_names, f"Missing tool definition: {exp}"

def test_copilot_status_endpoint(client):
    """Checks /api/copilot/status returns valid state."""
    res = client.get("/api/copilot/status")
    assert res.status_code == 200
    data = res.json()
    assert "groq_active" in data
    assert "model" in data
    assert "mode" in data

def test_copilot_chat_outdoor_safety(client):
    """Verifies that asking about going outside triggers outdoor & telemetry tools."""
    res = client.post("/api/copilot/chat", json={"message": "baire ki akhon jaowya jabe?", "history": []})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    tools = [t["name"] for t in data.get("tools_called", [])]
    assert "get_outdoor_and_satellite_air_quality" in tools
    assert len(data["response"]) > 20

def test_copilot_chat_medications_inquiry(client):
    """Verifies that asking about medication schedules triggers medication tracker tool."""
    res = client.post("/api/copilot/chat", json={"message": "amr osudh kowkhon khabo?", "history": []})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    tools = [t["name"] for t in data.get("tools_called", [])]
    assert "get_medications_and_schedule" in tools

def test_copilot_chat_log_rescue_puff(client):
    """Verifies that asking to log a puff triggers log_medication_dose tool."""
    res = client.post("/api/copilot/chat", json={"message": "ami 1 ta rescue puff nilam, log koro", "history": []})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    tools = [t["name"] for t in data.get("tools_called", [])]
    assert "log_medication_dose" in tools
    assert "লগ করা হয়েছে" in data["response"] or "logged" in data["response"].lower()

def test_copilot_chat_doctor_search(client):
    """Verifies doctor directory query triggers search_doctors_directory tool."""
    res = client.post("/api/copilot/chat", json={"message": "zaman doctor ar phone o chamber kothay?", "history": []})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    tools = [t["name"] for t in data.get("tools_called", [])]
    assert "search_doctors_directory" in tools
    assert "Zaman" in data["response"]

def test_copilot_chat_send_message_to_doctor(client):
    """Verifies sending consultation message triggers send_message_to_doctor tool."""
    res = client.post("/api/copilot/chat", json={"message": "doctor k bolo I feel chest tightness", "history": []})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    tools = [t["name"] for t in data.get("tools_called", [])]
    assert "send_message_to_doctor" in tools
    assert "মেসেজ পাঠানো হয়েছে" in data["response"] or "sent" in data["response"].lower()

def test_copilot_chat_sensor_telemetry(client):
    """Verifies live sensor telemetry query triggers get_live_telemetry_and_sensors."""
    res = client.post("/api/copilot/chat", json={"message": "live sensor telemetry data koto?", "history": []})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    tools = [t["name"] for t in data.get("tools_called", [])]
    assert "get_live_telemetry_and_sensors" in tools

def test_copilot_chat_air_quality_map(client):
    """Verifies air map and emergency hospital query triggers get_air_quality_map_and_emergency_facilities."""
    res = client.post("/api/copilot/chat", json={"message": "dhaka air map aqi koto and nearest hospital konta?", "history": []})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    tools = [t["name"] for t in data.get("tools_called", [])]
    assert "get_air_quality_map_and_emergency_facilities" in tools
    assert "AQI" in data["response"] or "এয়ার কোয়ালিটি" in data["response"] or "Hospital" in data["response"]

def test_copilot_chat_bengali_script_mirroring(client):
    """Verifies pure Bengali script query returns Bengali script response."""
    res = client.post("/api/copilot/chat", json={"message": "আমি কি এখন বাইরে যেতে পারি?", "history": []})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    # Bengali unicode characters present in response
    assert any(0x0980 <= ord(c) <= 0x09FF for c in data["response"])

def test_copilot_chat_xai_ml_banglish(client):
    """Verifies Banglish XAI & ML query triggers get_xai_clinical_risk_and_shap tool and explains feature drivers."""
    res = client.post("/api/copilot/chat", json={"message": "xai ml prediction koto? kon feature kno daiye?", "history": []})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    tools = [t["name"] for t in data.get("tools_called", [])]
    assert "get_xai_clinical_risk_and_shap" in tools
    # Verify response contains prediction and causal explanations
    resp = data["response"]
    assert "Prediction" in resp or "Green" in resp or "Yellow" in resp or "Red" in resp
    assert "TreeSHAP" in resp or "SHAP" in resp
    assert "daiye" in resp.lower() or "risk" in resp.lower()

def test_copilot_chat_xai_ml_bengali(client):
    """Verifies Bengali script XAI query triggers get_xai_clinical_risk_and_shap and returns Bengali script explanations."""
    res = client.post("/api/copilot/chat", json={"message": "আমার এক্সএআই প্রেডিকশন কেমন এবং কোন ফিচার কেন দায়ী?", "history": []})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    tools = [t["name"] for t in data.get("tools_called", [])]
    assert "get_xai_clinical_risk_and_shap" in tools
    assert any(0x0980 <= ord(c) <= 0x09FF for c in data["response"])
    assert "ঝুঁকি" in data["response"] or "প্রেডিকশন" in data["response"] or "দায়ী" in data["response"]

def test_copilot_chat_xai_ml_english(client):
    """Verifies English XAI query triggers get_xai_clinical_risk_and_shap and explains drivers and clinical rationale."""
    res = client.post("/api/copilot/chat", json={"message": "Explain my current asthma risk prediction and which features are responsible why", "history": []})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    tools = [t["name"] for t in data.get("tools_called", [])]
    assert "get_xai_clinical_risk_and_shap" in tools
    assert "TreeSHAP" in data["response"] or "Risk" in data["response"]
    assert "Drivers" in data["response"] or "Attribution" in data["response"]

def test_copilot_chat_encrypted_storage_and_history(client):
    """Verifies chat messages are stored encrypted with AES-256-GCM and decrypted on retrieval."""
    import sqlite3
    # 1. Clear existing history for test user
    client.delete("/api/copilot/history")

    # 2. Send a new copilot message
    chat_res = client.post("/api/copilot/chat", json={"message": "What is my current live sensor PM2.5?", "history": []})
    assert chat_res.status_code == 200
    assert chat_res.json()["success"] is True

    # 3. Fetch history via GET endpoint
    hist_res = client.get("/api/copilot/history")
    assert hist_res.status_code == 200
    hist_data = hist_res.json()
    assert hist_data["success"] is True
    assert hist_data["count"] >= 2 # at least user + assistant messages

    msgs = hist_data["messages"]
    user_msg = next((m for m in msgs if m["role"] == "user"), None)
    asst_msg = next((m for m in msgs if m["role"] == "assistant"), None)
    assert user_msg is not None
    assert user_msg["content"] == "What is my current live sensor PM2.5?"
    assert asst_msg is not None
    assert len(asst_msg["content"]) > 10

    # 4. Direct SQLite verification that raw stored text is encrypted (enc:v1:...)
    conn = sqlite3.connect("backend/respiguard.db")
    cur = conn.cursor()
    cur.execute("SELECT role, message_body, is_encrypted FROM copilot_messages ORDER BY created_at DESC LIMIT 2;")
    rows = cur.fetchall()
    conn.close()
    assert len(rows) >= 2
    for role, raw_body, is_enc in rows:
        assert raw_body.startswith("enc:v1:"), f"Database content not encrypted! Value: {raw_body}"
        assert is_enc == 1

    # 5. Clear history and verify empty
    del_res = client.delete("/api/copilot/history")
    assert del_res.status_code == 200
    empty_res = client.get("/api/copilot/history")
    assert empty_res.json()["count"] == 0

def test_copilot_chat_satellite_atmospheric_pollutant_breakdown(client):
    """Verifies that asking for Satellite Atmospheric Pollutant Breakdown calls tool and returns all pollutants without None."""
    res = client.post("/api/copilot/chat", json={
        "message": "Satellite Atmospheric Pollutant Breakdown ar value koto h akhon",
        "history": []
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    tools = [t["name"] for t in data.get("tools_called", [])]
    assert "get_outdoor_and_satellite_air_quality" in tools
    resp = data["response"]
    assert "None µg/m³" not in resp
    assert "Ozone: None" not in resp
    assert "PM2.5" in resp
    assert ("Ozone" in resp or "O3" in resp or "ওজোন" in resp)

def test_copilot_chat_doctor_message_natural_banglish(client):
    """Verifies that 'doctor zaman k hello send korte parbe?' invokes send_message_to_doctor."""
    res = client.post("/api/copilot/chat", json={
        "message": "doctor zaman k hello send korte parbe?",
        "history": []
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    tools = [t["name"] for t in data.get("tools_called", [])]
    assert "send_message_to_doctor" in tools
    resp = data["response"]
    assert "Dr. Zaman" in resp or "doctor" in resp.lower()
    assert ("sent" in resp.lower() or "পাঠানো" in resp or "delivered" in resp.lower())

def test_copilot_chat_doctor_followup_affirmation(client):
    """Verifies that follow-up affirmation 'deo' sends message when doctor was discussed in previous turn."""
    history = [
        {"role": "user", "content": "doctor zaman k hello send korte parbe?"},
        {"role": "assistant", "content": "Apni Dr. Zaman Islam k message pathate paren."}
    ]
    res = client.post("/api/copilot/chat", json={
        "message": "deo",
        "history": history
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    tools = [t["name"] for t in data.get("tools_called", [])]
    assert "send_message_to_doctor" in tools




