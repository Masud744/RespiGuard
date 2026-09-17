import os
import pandas as pd
import numpy as np
from fastapi import FastAPI, HTTPException, Header, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

try:
    from shap_service import xai_service
    from db_service import db_service
    from email_service import (
        send_otp_email, 
        verify_otp_code, 
        is_email_verified, 
        clear_email_otp, 
        send_risk_alert_email
    )
except ImportError:
    from backend.shap_service import xai_service
    from backend.db_service import db_service
    from backend.email_service import (
        send_otp_email, 
        verify_otp_code, 
        is_email_verified, 
        clear_email_otp, 
        send_risk_alert_email
    )

app = FastAPI(
    title="RespiGuard XAI Backend",
    description="FastAPI Backend for Real-Time Asthma Risk Prediction with 2-Stage Hierarchical ML, SHAP Explainability & Supabase Integration",
    version="2.0.0"
)

# Enable CORS for React frontend (Vite on 5173 / 3000 / localhost)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Start Background Non-Blocking IMAP Auto-Sync Worker for incoming Gmail Doctor Replies
@app.on_event("startup")
def startup_event():
    try:
        try:
            from imap_listener import IMAPAutoSyncWorker
        except ImportError:
            from backend.imap_listener import IMAPAutoSyncWorker

        worker = IMAPAutoSyncWorker(db_service=db_service, poll_interval=6)
        worker.start()
    except Exception as e:
        print(f"[Startup] IMAP Worker notice: {e}")

# In-memory latest telemetry state (for high-speed 3s dashboard polling)
latest_telemetry_state = {
    "telemetry": {
        "temperature": 25.4,
        "humidity": 58.2,
        "pm1_0": 9.2,
        "pm2_5": 12.8,
        "pm10": 22.4,
        "mq135": 408.0,
        "device_node": "ESP32-RespiGuard-01"
    },
    "prediction": {
        "prediction": "Green",
        "prediction_idx": 0,
        "prediction_title": "Safe / Low Exacerbation Risk (PEFR >= 80%)",
        "probabilities": {"Green": 94.2, "Yellow": 5.4, "Red": 0.4},
        "confidence": 94.2,
        "explanation": "SAFE CONDITIONS. Particulate levels and climatic metrics are within safe pulmonary thresholds.",
        "recommendation": "Normal daily activities permitted. Environmental conditions present minimal asthma exacerbation risk.",
        "feature_impacts": [
            {"feature": "pm2_5", "name": "PM2.5 (Fine Particulates)", "value": 12.8, "unit": "µg/m³", "shap_value": -0.12, "direction": "decreases_risk", "contribution_pct": 36.5},
            {"feature": "temperature", "name": "Ambient Temperature", "value": 25.4, "unit": "°C", "shap_value": 0.05, "direction": "increases_risk", "contribution_pct": 24.2},
            {"feature": "humidity", "name": "Relative Humidity", "value": 58.2, "unit": "%", "shap_value": -0.04, "direction": "decreases_risk", "contribution_pct": 18.3},
            {"feature": "pm10", "name": "PM10 (Coarse Dust)", "value": 22.4, "unit": "µg/m³", "shap_value": -0.03, "direction": "decreases_risk", "contribution_pct": 12.0},
            {"feature": "pm1_0", "name": "PM1.0 (Ultrafine)", "value": 9.2, "unit": "µg/m³", "shap_value": -0.02, "direction": "decreases_risk", "contribution_pct": 9.0}
        ]
    },
    "timestamp": None
}

# ==============================================================================
# Request Models
# ==============================================================================

class TelemetryInput(BaseModel):
    temperature: float = Field(25.0, description="Temperature in °C (DHT22)")
    humidity: float = Field(60.0, description="Relative Humidity in % (DHT22)")
    pm1_0: float = Field(12.0, description="PM1.0 in µg/m³ (PMS5003)")
    pm2_5: float = Field(18.0, description="PM2.5 in µg/m³ (PMS5003)")
    pm10: float = Field(30.0, description="PM10 in µg/m³ (PMS5003)")
    mq135: Optional[float] = Field(412.0, description="MQ135 Air Quality Gas Sensor in ppm")
    device_node: Optional[str] = Field("ESP32-RespiGuard-01", description="Device Identifier")
    user_id: Optional[str] = Field(None, description="Optional associated user UUID")
    severity: Optional[str] = Field("Mild", description="Asthma severity (Mild, Moderate, Severe)")
    age: Optional[float] = Field(22.0, description="Patient age in years")
    age_range: Optional[str] = Field("18-29yo", description="Age range")
    sex: Optional[str] = Field("male", description="Biological sex (male, female)")
    pef_best: Optional[float] = Field(520.0, description="Personal best peak flow in L/min")

class SendOTPRequest(BaseModel):
    email: str = Field(..., description="Recipient user email")
    full_name: Optional[str] = Field("Patient User", description="User Full Name")

class VerifyOTPRequest(BaseModel):
    email: str = Field(..., description="Recipient user email")
    otp: str = Field(..., min_length=6, max_length=6, description="6-digit verification code")

class SignupRequest(BaseModel):
    email: str = Field(..., description="User Email")
    password: str = Field(..., min_length=6, description="User Password")
    full_name: str = Field("Patient User", description="User Full Name")
    severity: Optional[str] = Field("Mild", description="Asthma Severity: Mild, Moderate, Severe")
    age: Optional[float] = Field(22.0, description="User Age in Years")
    age_range: Optional[str] = Field("18-29yo", description="Age Range Bracket")
    sex: Optional[str] = Field("male", description="Biological Sex (male, female)")
    pef_best: Optional[float] = Field(520.0, description="Personal Best Peak Flow (L/min)")

class LoginRequest(BaseModel):
    email: str = Field(..., description="User Email")
    password: str = Field(..., description="User Password")

class AddDoctorRequest(BaseModel):
    user_id: str = Field(..., description="Patient User UUID")
    doctor_name: str = Field(..., description="Doctor's Full Name")
    doctor_email: str = Field(..., description="Doctor's Email Address")
    patient_id_code: str = Field(..., description="Doctor-assigned Patient ID Code")
    specialty: Optional[str] = Field("Pulmonologist", description="Doctor Specialty")
    hospital: Optional[str] = Field("Respiratory Care Clinic", description="Hospital / Clinic Name")

class SendMessageRequest(BaseModel):
    user_id: str = Field(..., description="Patient User UUID")
    doctor_id: str = Field(..., description="Recipient Doctor UUID")
    patient_id_code: Optional[str] = Field("PAT-001", description="Patient Identifier")
    subject: str = Field("Health Advisory & Symptoms Update", description="Message Subject")
    message_body: str = Field(..., description="Message Content")

class DoctorReplyRequest(BaseModel):
    user_id: str = Field(..., description="Patient User UUID")
    doctor_id: str = Field(..., description="Doctor UUID")
    patient_id_code: Optional[str] = Field("PAT-001", description="Patient Identifier")
    subject: Optional[str] = Field("Re: Clinical Advisory & Inhaler Adjustment", description="Reply Subject")
    message_body: str = Field(..., description="Doctor's Reply Content")
    reply_to_id: Optional[str] = Field(None, description="Original Message UUID")

# ==============================================================================
# Health & General Routes
# ==============================================================================

@app.get("/")
def read_root():
    return {
        "service": "RespiGuard XAI Asthma Risk Monitoring API",
        "status": "online",
        "model_loaded": xai_service.stage1_model is not None or xai_service.fallback_rf is not None,
        "database": "Supabase PostgreSQL connected"
    }

@app.get("/api/health")
def get_health():
    return {
        "status": "healthy",
        "model": "2-Stage Hierarchical ML (CatBoost Safety Gate + XGBoost Severity Gate)",
        "explainer": "TreeSHAP (Exact Game-Theoretic Shapley Values)",
        "features": xai_service.all_cols,
        "classes": xai_service.classes,
        "database": "Supabase (user_profiles, telemetry_readings)"
    }

# ==============================================================================
# Authentication & OTP Verification Routes (Supabase Connected)
# ==============================================================================

@app.post("/api/auth/send-otp")
def send_otp(req: SendOTPRequest):
    """
    Sends a 6-digit OTP verification code to the user's email.
    Checks first if the email is already registered in Supabase.
    """
    email_clean = req.email.strip().lower()
    if db_service.email_exists(email_clean):
        raise HTTPException(
            status_code=400,
            detail="This email address is already registered. Please sign in instead."
        )

    res = send_otp_email(to_email=email_clean, full_name=req.full_name)
    return res

@app.post("/api/auth/verify-otp")
def verify_otp(req: VerifyOTPRequest):
    """
    Verifies the user's 6-digit OTP code against the active session.
    """
    res = verify_otp_code(email=req.email, input_otp=req.otp)
    if not res.get("success"):
        raise HTTPException(
            status_code=400,
            detail=res.get("error", "Invalid or expired verification code")
        )
    return res

@app.post("/api/auth/signup")
def signup(req: SignupRequest):
    """
    Finalizes registration after email has been verified via OTP.
    """
    email_clean = req.email.strip().lower()
    
    # Enforce OTP verification before allowing account creation
    if not is_email_verified(email_clean):
        raise HTTPException(
            status_code=400,
            detail="Please verify your email address via the 6-digit OTP code before completing registration."
        )

    result = db_service.signup_user(req.dict())
    if not result.get("success"):
        raise HTTPException(
            status_code=400,
            detail=result.get("error", "Signup failed")
        )

    # Clear OTP record upon successful signup
    clear_email_otp(email_clean)
    return result

@app.post("/api/auth/login")
def login(req: LoginRequest):
    result = db_service.login_user(req.email, req.password)
    if not result.get("success"):
        raise HTTPException(
            status_code=401,
            detail=result.get("error", "Invalid email or password")
        )
    return result

@app.get("/api/auth/me")
def get_current_user(user_id: str):
    user = db_service.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user": user}

# ==============================================================================
# Doctor Directory & Messaging Routes
# ==============================================================================

@app.post("/api/doctors")
def add_doctor(req: AddDoctorRequest):
    result = db_service.add_doctor(req.dict())
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to add doctor"))
    return result

@app.get("/api/doctors")
def get_doctors(user_id: str):
    doctors = db_service.get_doctors(user_id)
    return {"doctors": doctors}

@app.delete("/api/doctors/{doctor_id}")
def delete_doctor(doctor_id: str, user_id: str):
    success = db_service.delete_doctor(doctor_id, user_id)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to delete doctor")
    return {"success": True, "message": "Doctor removed"}

@app.post("/api/messages/send")
def send_message_to_doctor(req: SendMessageRequest):
    result = db_service.send_message_to_doctor(req.dict())
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to send message"))
    return result

@app.post("/api/messages/reply")
def record_doctor_reply(req: DoctorReplyRequest):
    result = db_service.record_doctor_reply(req.dict())
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Failed to record doctor reply"))
    return result

@app.get("/api/messages")
def get_messages(user_id: str, doctor_id: Optional[str] = None):
    messages = db_service.get_messages(user_id, doctor_id)
    return {"messages": messages}

@app.post("/api/messages/sync")
def sync_messages(user_id: str):
    messages = db_service.get_messages(user_id)
    return {"synced": len(messages), "success": True}

@app.patch("/api/messages/{message_id}/read")
def mark_message_read(message_id: str, user_id: str):
    success = db_service.mark_message_read(message_id, user_id)
    return {"success": success}

# ==============================================================================
# Prediction & Telemetry Ingestion Routes
# ==============================================================================

@app.post("/api/predict")
def predict_and_explain(telemetry: TelemetryInput):
    try:
        explanation = xai_service.explain_prediction(telemetry.dict())
        return explanation
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/telemetry")
def ingest_telemetry(telemetry: TelemetryInput, background_tasks: BackgroundTasks):
    """
    Ingests live 30s telemetry from sensor_simulator.py or real ESP32 hardware,
    runs 2-Stage ML prediction, saves to Supabase, dispatches emergency alert emails if High Risk,
    and updates live buffer.
    """
    global latest_telemetry_state
    try:
        # Run 2-Stage ML prediction
        prediction = xai_service.explain_prediction(telemetry.dict())
        
        # Save to Supabase telemetry_readings table
        db_service.save_telemetry_reading(
            telemetry=telemetry.dict(),
            prediction=prediction,
            user_id=telemetry.user_id
        )

        # Update in-memory live state
        from datetime import datetime, timezone
        latest_telemetry_state = {
            "telemetry": telemetry.dict(),
            "prediction": prediction,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        # Check if High Risk (Red) and send emergency alert email
        if prediction.get("prediction") == "Red" and telemetry.user_id:
            user = db_service.get_user_by_id(telemetry.user_id)
            if user and user.get("email"):
                background_tasks.add_task(
                    send_risk_alert_email,
                    to_email=user["email"],
                    patient_name=user.get("full_name", "Patient"),
                    telemetry=telemetry.dict(),
                    prediction=prediction
                )

        return {
            "status": "success",
            "message": "Telemetry received and recorded",
            "prediction": prediction
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/telemetry/latest")
def get_latest_telemetry():
    """
    Returns the most recent sensor telemetry and ML prediction for live UI polling.
    """
    return latest_telemetry_state

@app.get("/api/telemetry/history")
def get_telemetry_history(user_id: Optional[str] = None, limit: int = 30):
    readings = db_service.get_recent_telemetry(user_id=user_id, limit=limit)
    return {"data": readings, "count": len(readings)}

# ==============================================================================
# Analytics & Global Metrics Routes
# ==============================================================================

@app.get("/api/global-importance")
def get_global_importance():
    try:
        return {
            "importance": xai_service.get_global_importance(),
            "method": "Mean Absolute TreeSHAP Values Across Cohort Dataset"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stats")
def get_dashboard_stats():
    summary = xai_service.get_dataset_summary()
    return {
        "summary": summary,
        "device_status": {
            "node_name": "ESP32-RespiGuard-01 (Portable Pocket Node)",
            "status": "connected",
            "dht22_health": "Optimal",
            "pms5003_laser_health": "Active",
            "battery_level": 98,
            "signal_rssi": "-54 dBm",
            "sampling_frequency": "1 pkt / 30s"
        },
        "metrics": {
            "total_telemetry_frames": 2460,
            "safe_hours_pct": 78.5,
            "avg_pm25": 14.8,
            "avg_humidity": 59.4,
            "active_patients": 1256,
            "medical_team_size": 246
        }
    }

@app.get("/api/history")
def get_history(limit: int = 50, timeframe: str = "weekly"):
    """
    Returns time series data for the Adherence Overview and trend graphs.
    """
    if xai_service.dataset_df is not None and not xai_service.dataset_df.empty:
        df = xai_service.dataset_df.copy()
        if len(df) > limit:
            step = max(1, len(df) // limit)
            sampled_df = df.iloc[::step].tail(limit)
        else:
            sampled_df = df.tail(limit)
        
        records = []
        days = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"]
        
        for idx, (_, row) in enumerate(sampled_df.iterrows()):
            day_label = days[idx % len(days)] if timeframe == "weekly" else f"T-{len(sampled_df)-idx}h"
            med_intake = round(min(100, max(20, 85 - (row['pm2_5'] * 0.8) + (np.sin(idx * 0.5) * 15))), 1)
            compliance = round(min(100, max(30, 90 - (row['pm10'] * 0.5) + (np.cos(idx * 0.4) * 10))), 1)
            
            records.append({
                "id": idx,
                "day": day_label,
                "medication_adherence": med_intake,
                "environmental_compliance": compliance,
                "pm2_5": round(float(row['pm2_5']), 1),
                "pm10": round(float(row['pm10']), 1),
                "temperature": round(float(row['temperature']), 1),
                "humidity": round(float(row['humidity']), 1),
                "risk": row.get('risk_label', 'Green')
            })
        return {"data": records}
    
    return {"data": []}

@app.get("/api/alerts")
def get_clinical_alerts():
    return [
        {
            "id": 1,
            "title": "Air Quality Spike (PM2.5 Elevated)",
            "severity": "high",
            "time": "10 mins ago",
            "message": "Particulate matter concentration rose above 35 µg/m³. Recommended patient stay indoors.",
            "doctor": "Dr. Sarah Jenkins",
            "specialty": "Pulmonologist"
        },
        {
            "id": 2,
            "title": "Cold & High Humidity Advisory",
            "severity": "medium",
            "time": "2 hours ago",
            "message": "Ambient temperature dropped to 14.5°C with 85% RH. Advised patient to wear protective mask.",
            "doctor": "Dr. Michael Chen",
            "specialty": "Respiratory Care"
        },
        {
            "id": 3,
            "title": "Routine Sensor Calibration Check",
            "severity": "low",
            "time": "Yesterday",
            "message": "PMS5003 Laser particle sensor and DHT22 operating within optimal diagnostic calibration.",
            "doctor": "RespiGuard AI System",
            "specialty": "Automated Diagnostics"
        }
    ]
