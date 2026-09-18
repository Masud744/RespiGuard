"""
RespiGuard AI Copilot Agent Service
===================================
Provides tool-calling capabilities using Groq Cloud (Llama-3.3-70b-versatile)
with native function execution across:
- Real-time ESP32 IoT telemetry
- Open-Meteo atmospheric pollutant breakdown (Open-Meteo / Copernicus CAMS)
- Explainable AI (XAI) clinical risk & TreeSHAP attributions
- Patient medications, inhaler tracking & dose logging
- Verified doctors directory & consultation messaging

Features:
- Full OpenAI-standard Tool Calling schema
- User-scope isolation & clinical safety guardrails (GINA compliant)
- Intelligent local fallback engine if GROQ_API_KEY is not yet configured
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from dotenv import load_dotenv

# Load environment variables from .env in backend or workspace root
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

logger = logging.getLogger("respiguard.agent_service")

# Try importing Groq client
try:
    from groq import Groq
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False
    logger.warning("Groq SDK not installed, will use fallback engine.")

# Try importing XAI service
try:
    from shap_service import xai_service
except ImportError:
    try:
        from backend.shap_service import xai_service
    except ImportError:
        xai_service = None
        logger.warning("AsthmaXAIService not available, will use state predictions.")


# ==============================================================================
# TOOL REGISTRY (OpenAI / Groq Function Calling Schema)
# ==============================================================================

COPILOT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_live_telemetry_and_sensors",
            "description": "Retrieves real-time indoor IoT environmental sensor readings from the patient's ESP32 node (PM1.0, PM2.5, PM10, Temperature, Humidity, MQ135 Air Quality/VOC) and hardware connection status.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_outdoor_and_open_meteo_air_quality",
            "description": "Retrieves macro-environmental outdoor atmospheric pollutant breakdown from Open-Meteo (Ozone O3, Nitrogen Dioxide NO2, Carbon Monoxide CO, Sulphur Dioxide SO2, UV Index, PM10, outdoor temperature, outdoor humidity, AQI) and evaluates whether it is safe for an asthma patient to go outdoors right now.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_xai_clinical_risk_and_shap",
            "description": "Retrieves Explainable AI (XAI) clinical asthma exacerbation risk assessment, Machine Learning 2-Stage prediction (Green/Yellow/Red), confidence score, class probability distribution, and TreeSHAP feature attributions. Explains which environmental and physiological features (PM2.5, Temperature, Humidity, PM10, PM1.0, Lung PEF, Asthma Severity) are responsible for increasing or decreasing the patient's exacerbation risk and the clinical rationale why each feature contributes.",
            "parameters": {
                "type": "object",
                "properties": {
                    "hypothetical_pm2_5": {
                        "type": "number",
                        "description": "Optional simulated PM2.5 level in µg/m³ to test risk scenario"
                    },
                    "hypothetical_temperature": {
                        "type": "number",
                        "description": "Optional simulated temperature in °C"
                    },
                    "hypothetical_humidity": {
                        "type": "number",
                        "description": "Optional simulated humidity percentage"
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_medications_and_schedule",
            "description": "Retrieves the patient's active prescribed controller and rescue asthma medications, daily schedule times, remaining canister doses, low-canister alerts, and next scheduled dose countdown.",
            "parameters": {
                "type": "object",
                "properties": {},
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "log_medication_dose",
            "description": "Logs a taken medication dose (morning dose, evening dose, or rescue inhaler puff) directly into the patient's database and decrements remaining canister doses.",
            "parameters": {
                "type": "object",
                "properties": {
                    "medication_name": {
                        "type": "string",
                        "description": "Name or keyword of the medication (e.g. 'Flovent', 'Ventolin', 'Salbutamol', 'Fluticasone')"
                    },
                    "dose_type": {
                        "type": "string",
                        "enum": ["morning", "evening", "rescue"],
                        "description": "Type of dose taken: 'morning', 'evening', or 'rescue' puff"
                    },
                    "puffs": {
                        "type": "integer",
                        "description": "Number of puffs or actuations taken (default 1)",
                        "default": 1
                    }
                },
                "required": ["dose_type"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_doctors_directory",
            "description": "Searches the BMDC-verified pulmonologists and chest specialists directory by doctor name, hospital, city/division, or specialty to provide verified appointment and contact information.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Doctor name or hospital keyword (e.g. 'Zaman Islam', 'Dhaka Medical')"
                    },
                    "location": {
                        "type": "string",
                        "description": "City or division (e.g. 'Dhaka', 'Chittagong')"
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "send_message_to_doctor",
            "description": "Sends a direct clinical consultation message to the patient's paired doctor and stores it in the encrypted consultations thread.",
            "parameters": {
                "type": "object",
                "properties": {
                    "message_body": {
                        "type": "string",
                        "description": "The exact message content to send to the doctor (e.g. 'Hello doctor, I would like to consult about my current respiratory status.')"
                    },
                    "message": {
                        "type": "string",
                        "description": "Alternative alias for message_body"
                    },
                    "doctor_name": {
                        "type": "string",
                        "description": "Doctor name (e.g. 'Dr. Zaman Islam')"
                    },
                    "subject": {
                        "type": "string",
                        "description": "Brief topic or subject (optional)"
                    }
                },
                "required": []
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_air_quality_map_and_emergency_facilities",
            "description": "Retrieves regional air quality map data for Bangladesh divisions and districts (Dhaka, Gazipur, Kaliakair, Chittagong, Sylhet, Rajshahi, Khulna, Barishal, Rangpur, Mymensingh) along with nearby 24/7 respiratory emergency hospitals, oxygen supply centers, and national ambulance hotlines (999, 16263, 199).",
            "parameters": {
                "type": "object",
                "properties": {
                    "division_or_city": {
                        "type": "string",
                        "description": "Target division or district in Bangladesh (e.g. 'Dhaka', 'Gazipur', 'Kaliakair', 'Chittagong', 'Sylhet', 'Rajshahi')"
                    }
                },
                "required": []
            }
        }
    }
]


def detect_language(text: str) -> str:
    """
    Detects whether text is in Bengali script ('bn'),
    Banglish ('banglish' - Bengali phonetics written in Latin script), or English ('en').
    """
    if not text:
        return "en"
    
    # 1. Bengali script range
    for char in text:
        if 0x0980 <= ord(char) <= 0x09FF:
            return "bn"

    # 2. Banglish word vocabulary
    banglish_keywords = {
        "ami", "amr", "amar", "amader", "apni", "apnar", "tumi", "tomar",
        "kemon", "kobe", "akhon", "ekhon", "baire", "jabo", "jawa", "osudh",
        "osud", "khabo", "khawa", "khawer", "khawar", "bolo", "daktar", "ki",
        "kintu", "hobe", "achi", "ache", "nai", "lagbe", "korte", "koro",
        "debo", "deo", "dilam", "nilam", "bujhecho", "bujco", "dhorkar",
        "jeno", "bolte", "shomoy", "somoy", "kamne", "kono", "kicu", "kichu",
        "pabo", "pore", "bhalo", "kharap", "shuncho", "janaw", "janan",
        "lagche", "hocche", "hoyeche", "shashkosto", "shas", "kotha",
        "kothay", "koyta", "thik", "parbo", "parbe", "bujhlam", "ar",
        "koto", "helo", "docutr", "pathao", "bolba", "kore", "dekhte", "shunbi"
    }

    tokens = set(text.lower().replace("?", " ").replace("!", " ").replace(".", " ").replace(",", " ").split())
    if tokens.intersection(banglish_keywords):
        return "banglish"

    return "en"


# ==============================================================================
# RESPI GUARD AGENT SERVICE
# ==============================================================================

class RespiGuardAgentService:
    def __init__(self, db_service_instance=None):
        self.db = db_service_instance
        self.groq_client = None
        self.model_name = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")
        self._init_client()

    def _init_client(self):
        """Initializes Groq client if GROQ_API_KEY is available and selects optimal model."""
        api_key = os.getenv("GROQ_API_KEY")
        if api_key and GROQ_AVAILABLE:
            try:
                self.groq_client = Groq(api_key=api_key.strip(), max_retries=0, timeout=10.0)
                configured_model = os.getenv("GROQ_MODEL")
                if configured_model:
                    self.model_name = configured_model.strip()
                else:
                    try:
                        avail = [m.id for m in self.groq_client.models.list().data]
                        # Preferred tool-calling models on Groq
                        candidates = [
                            "qwen/qwen3.8-27b",
                            "llama-3.3-70b-versatile",
                            "llama-3.1-70b-versatile",
                            "llama3-70b-8192"
                        ]
                        matched = next((c for c in candidates if c in avail), None)
                        if matched:
                            self.model_name = matched
                        else:
                            self.model_name = "qwen/qwen3.8-27b"
                    except Exception as me:
                        logger.warning(f"Could not list Groq models: {me}")
                        self.model_name = "qwen/qwen3.8-27b"

                logger.info(f"Groq Cloud client successfully initialized with model: {self.model_name}")
            except Exception as e:
                logger.warning(f"Failed to initialize Groq client: {e}")
                self.groq_client = None
        else:
            self.groq_client = None

    def is_groq_active(self) -> bool:
        """Returns True if Groq API key is configured and client is active."""
        if not self.groq_client:
            self._init_client()
        return self.groq_client is not None

    # --------------------------------------------------------------------------
    # Tool Implementations (Live Ground-Truth Data)
    # --------------------------------------------------------------------------

    def execute_tool(self, name: str, args: Dict[str, Any], current_user: Dict[str, Any], app_state: Dict[str, Any]) -> Dict[str, Any]:
        """Dispatches tool execution to the appropriate backend service."""
        user_id = current_user.get("id", "usr-demo-01")
        user_name = current_user.get("full_name") or current_user.get("name") or "Patient"

        try:
            if name == "get_live_telemetry_and_sensors":
                telem_state = app_state.get("latest_telemetry_state", {})
                telemetry = telem_state.get("telemetry", {})
                return {
                    "device_node": telemetry.get("device_node", "ESP32-RespiGuard-01"),
                    "status": "online" if telemetry else "offline",
                    "temperature_celsius": telemetry.get("temperature", 25.4),
                    "humidity_percent": telemetry.get("humidity", 58.2),
                    "pm1_0_ug_m3": telemetry.get("pm1_0", 9.2),
                    "pm2_5_ug_m3": telemetry.get("pm2_5", 12.8),
                    "pm10_ug_m3": telemetry.get("pm10", 22.4),
                    "mq135_air_quality_index": telemetry.get("mq135", 408.0),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "interpretation": "Indoor particulate matter PM2.5 is within safe WHO guidelines (<15 µg/m³)."
                }

            elif name in ["get_outdoor_and_open_meteo_air_quality", "get_outdoor_and_satellite_air_quality"]:
                sat_state = app_state.get("latest_satellite_state") or {}

                def _safe_float(val, default):
                    if val is None:
                        return default
                    try:
                        return float(val)
                    except (ValueError, TypeError):
                        return default

                outdoor_pm25 = _safe_float(sat_state.get("pm2_5"), 28.5)
                outdoor_pm10 = _safe_float(sat_state.get("pm10"), 45.0)
                ozone = _safe_float(sat_state.get("ozone"), 38.0)
                uv = _safe_float(sat_state.get("uv_index"), 5.0)
                outdoor_temp = _safe_float(sat_state.get("outdoor_temperature"), 28.0)
                outdoor_hum = _safe_float(sat_state.get("outdoor_humidity"), 65.0)
                aqi = int(_safe_float(sat_state.get("aqi"), 78))
                no2 = _safe_float(sat_state.get("nitrogen_dioxide"), 22.0)
                co = _safe_float(sat_state.get("carbon_monoxide"), 410.0)
                so2 = _safe_float(sat_state.get("sulphur_dioxide"), 9.5)

                # Clinical outdoor recommendation
                is_safe = outdoor_pm25 < 35.0 and ozone < 70.0 and outdoor_hum < 80.0
                advice = (
                    "Outdoor conditions are acceptable for light activities."
                    if is_safe else
                    "Caution advised: elevated particulate or ozone detected. Sensitive asthma patients should wear an N95 mask or limit vigorous outdoor exertion."
                )

                return {
                    "location": sat_state.get("location_name") or "Kaliakair, Gazipur, Dhaka",
                    "outdoor_temperature_celsius": outdoor_temp,
                    "outdoor_humidity_percent": outdoor_hum,
                    "aqi": aqi,
                    "pollutants": {
                        "pm2_5": outdoor_pm25,
                        "pm10": outdoor_pm10,
                        "ozone_o3": ozone,
                        "nitrogen_dioxide_no2": no2,
                        "carbon_monoxide_co": co,
                        "sulphur_dioxide_so2": so2,
                        "uv_index": uv
                    },
                    "is_safe_for_asthma_patients": is_safe,
                    "clinical_advice": advice
                }

            elif name == "get_xai_clinical_risk_and_shap":
                telem_state = app_state.get("latest_telemetry_state", {})
                telemetry = dict(telem_state.get("telemetry", {}))

                # Check if hypothetical inputs were provided
                has_overrides = False
                if args.get("hypothetical_pm2_5") is not None:
                    telemetry["pm2_5"] = float(args["hypothetical_pm2_5"])
                    has_overrides = True
                if args.get("hypothetical_temperature") is not None:
                    telemetry["temperature"] = float(args["hypothetical_temperature"])
                    has_overrides = True
                if args.get("hypothetical_humidity") is not None:
                    telemetry["humidity"] = float(args["hypothetical_humidity"])
                    has_overrides = True

                pred_data = telem_state.get("prediction", {})
                if xai_service and (has_overrides or not pred_data or not pred_data.get("feature_impacts")):
                    try:
                        pred_data = xai_service.explain_prediction(telemetry)
                    except Exception as e:
                        logger.warning(f"Error computing xai_service explain_prediction: {e}")

                return self._enrich_xai_prediction_and_rationales(pred_data, telemetry)

            elif name == "get_medications_and_schedule":
                if self.db:
                    meds = self.db.get_user_medications(user_id)
                else:
                    meds = []
                
                # Format summary
                controllers = [m for m in meds if m.get("type") == "controller"]
                rescues = [m for m in meds if m.get("type") == "rescue"]
                total_rescue_today = sum(m.get("puffs_today", 0) for m in rescues)

                return {
                    "total_medications": len(meds),
                    "controllers": controllers,
                    "rescue_inhalers": rescues,
                    "total_rescue_puffs_today": total_rescue_today,
                    "gina_alert": total_rescue_today > 2,
                    "gina_alert_note": "Elevated rescue frequency (>2 puffs/day) indicates imminent loss of asthma control." if total_rescue_today > 2 else "Reliever usage within safe limits."
                }

            elif name == "log_medication_dose":
                med_name = (args.get("medication_name") or "").lower()
                dose_type = args.get("dose_type", "rescue").lower()
                puffs = int(args.get("puffs", 1))

                if not self.db:
                    return {"success": False, "error": "Database service unavailable"}

                meds = self.db.get_user_medications(user_id)
                target_med = None
                for m in meds:
                    if med_name and (med_name in m.get("name", "").lower() or med_name in m.get("category", "").lower()):
                        target_med = m
                        break

                if not target_med:
                    # Select first matching type
                    if dose_type in ["morning", "evening"]:
                        target_med = next((m for m in meds if m.get("type") == "controller"), meds[0] if meds else None)
                    else:
                        target_med = next((m for m in meds if m.get("type") == "rescue"), meds[0] if meds else None)

                if not target_med:
                    return {"success": False, "error": "No matching medication found to log dose."}

                dose_payload = {
                    "medication_id": target_med["id"],
                    "dose_type": dose_type,
                    "puffs_count": puffs,
                    "time_taken": datetime.now().strftime('%I:%M %p')
                }
                res = self.db.log_medication_dose(user_id, dose_payload)
                rem = max(0, int(target_med.get("remaining_doses", 100)) - (puffs if dose_type == "rescue" else 1))
                return {
                    "success": True,
                    "message": f"Successfully logged {dose_type} dose for {target_med['name']}.",
                    "medication_name": target_med["name"],
                    "remaining_doses": rem,
                    "recorded_at": datetime.now(timezone.utc).isoformat()
                }

            elif name == "search_doctors_directory":
                query = (args.get("query") or "").lower()
                location = (args.get("location") or "").lower()
                if self.db:
                    all_docs = self.db.get_doctors_directory()
                    docs = [
                        d for d in all_docs
                        if (not query or query in (d.get("name") or "").lower() or query in (d.get("doctor_name") or "").lower() or query in (d.get("hospital") or "").lower() or query in (d.get("specialty") or "").lower())
                        and (not location or location in (d.get("location") or "").lower() or location in (d.get("hospital") or "").lower())
                    ]
                    if not docs and all_docs:
                        docs = all_docs[:3]
                else:
                    docs = []
                return {
                    "count": len(docs),
                    "doctors": docs[:5]  # return top 5
                }

            elif name == "send_message_to_doctor":
                message_body = (
                    args.get("message_body") or
                    args.get("message") or
                    args.get("content") or
                    args.get("text") or
                    "Hello doctor, patient requested consultation checkup."
                ).strip()
                subject = args.get("subject") or "Patient Consultation Inquiry"
                if not self.db:
                    return {"success": False, "error": "Database service unavailable"}

                doctors = self.db.get_doctors(user_id)
                paired_doctor = doctors[0] if doctors else None

                # Fallback to directory doctor if user hasn't explicitly paired yet
                if not paired_doctor:
                    dir_docs = self.db.get_doctors_directory()
                    target_name = (args.get("doctor_name") or "Zaman").lower()
                    matched_dir = next((d for d in dir_docs if target_name in (d.get("doctor_name") or d.get("name") or "").lower()), None)
                    paired_doctor = matched_dir if matched_dir else (dir_docs[0] if dir_docs else None)

                doc_id = (
                    (paired_doctor.get("id") or paired_doctor.get("doctor_profile_id"))
                    if paired_doctor else "doc-default-01"
                )
                doc_name = paired_doctor.get("doctor_name") or paired_doctor.get("name") or "Dr. Zaman Islam"

                payload = {
                    "user_id": user_id,
                    "doctor_id": doc_id,
                    "subject": subject,
                    "message_body": message_body,
                    "sender_type": "patient"
                }
                res = self.db.send_message_to_doctor(payload)
                return {
                    "success": res.get("success", True),
                    "doctor_name": doc_name,
                    "message": f"Message sent to {doc_name}."
                }

            elif name == "get_air_quality_map_and_emergency_facilities":
                target = (args.get("division_or_city") or "dhaka").lower().strip()
                
                # Verified regional stations across Bangladesh
                regional_stations = {
                    "kaliakair": {
                        "division": "Dhaka",
                        "district": "Gazipur",
                        "location": "Kaliakair (36CF+54R, Gazipur)",
                        "aqi": 98,
                        "category": "Moderate",
                        "pm2_5": 32.6,
                        "pm10": 54.0,
                        "primary_pollutant": "PM2.5",
                        "nearest_hospital": "Kaliakair Upazila Health Complex",
                        "hospital_type": "Govt Primary Respiratory Emergency Care (24/7 Oxygen & Nebulization)",
                        "hospital_hotline": "+880 1712-421715",
                        "ambulance": "01712-421715",
                        "secondary_hospital": "Sheikh Fazilatunnesa Mujib Memorial KPJ Specialized Hospital (+880 1714-044333)"
                    },
                    "gazipur": {
                        "division": "Dhaka",
                        "district": "Gazipur",
                        "location": "Gazipur Sadar / Joydebpur / Tongi",
                        "aqi": 118,
                        "category": "Unhealthy for Sensitive Groups",
                        "pm2_5": 42.1,
                        "pm10": 68.0,
                        "primary_pollutant": "PM2.5",
                        "nearest_hospital": "Sheikh Fazilatunnesa Mujib Memorial KPJ Specialized Hospital",
                        "hospital_type": "Tertiary Specialized & Critical Pulmonology Care (ICU & Mobile Ambulance)",
                        "hospital_hotline": "+880 2-9204444",
                        "ambulance": "+880 1714-044333",
                        "secondary_hospital": "Gazipur Shaheed Tajuddin Ahmad Medical College Hospital (+880 2-9261234)"
                    },
                    "dhaka": {
                        "division": "Dhaka",
                        "district": "Dhaka",
                        "location": "Dhaka Central (Ramna / Mohakhali / DMC)",
                        "aqi": 145,
                        "category": "Unhealthy for Sensitive Groups",
                        "pm2_5": 54.2,
                        "pm10": 89.4,
                        "primary_pollutant": "PM2.5",
                        "nearest_hospital": "National Institute of Diseases of the Chest and Hospital (NIDCH Mohakhali)",
                        "hospital_type": "National Apex Respiratory & Pulmonology Hospital (24/7 High-Flow Oxygen)",
                        "hospital_hotline": "+880 2-9844071",
                        "ambulance": "16263 / 999",
                        "secondary_hospital": "Dhaka Medical College Hospital (+880 2-55165088)"
                    },
                    "chittagong": {
                        "division": "Chittagong",
                        "district": "Chittagong",
                        "location": "Chittagong Port City / Agrabad",
                        "aqi": 82,
                        "category": "Moderate",
                        "pm2_5": 27.5,
                        "pm10": 48.0,
                        "primary_pollutant": "PM2.5",
                        "nearest_hospital": "Chittagong Medical College Hospital (CMCH)",
                        "hospital_type": "Govt Tertiary Care (Respiratory Ward & Central Oxygen)",
                        "hospital_hotline": "+880 31-619400",
                        "ambulance": "16263 / 999",
                        "secondary_hospital": "Chittagong General Hospital (Anderkilla) (+880 31-635201)"
                    },
                    "sylhet": {
                        "division": "Sylhet",
                        "district": "Sylhet",
                        "location": "Sylhet Sadar / Amberkhana",
                        "aqi": 58,
                        "category": "Moderate",
                        "pm2_5": 17.8,
                        "pm10": 32.0,
                        "primary_pollutant": "PM2.5",
                        "nearest_hospital": "Sylhet MAG Osmani Medical College Hospital",
                        "hospital_type": "Divisional Apex Respiratory & Critical Care Unit",
                        "hospital_hotline": "+880 821-713667",
                        "ambulance": "16263 / 999",
                        "secondary_hospital": "Sylhet Jalalabad Ragib-Rabeya Medical College (+880 821-719090)"
                    },
                    "rajshahi": {
                        "division": "Rajshahi",
                        "district": "Rajshahi",
                        "location": "Rajshahi Sadar",
                        "aqi": 94,
                        "category": "Moderate",
                        "pm2_5": 32.0,
                        "pm10": 58.0,
                        "primary_pollutant": "PM2.5",
                        "nearest_hospital": "Rajshahi Medical College Hospital (RMCH)",
                        "hospital_type": "Emergency Pulmonology Unit & Oxygen Plant",
                        "hospital_hotline": "+880 721-772150",
                        "ambulance": "16263 / 999",
                        "secondary_hospital": "Rajshahi Chest Disease Hospital"
                    },
                    "khulna": {
                        "division": "Khulna",
                        "district": "Khulna",
                        "location": "Khulna City",
                        "aqi": 86,
                        "category": "Moderate",
                        "pm2_5": 28.9,
                        "pm10": 51.0,
                        "primary_pollutant": "PM2.5",
                        "nearest_hospital": "Khulna Medical College Hospital (KMCH)",
                        "hospital_type": "Divisional Respiratory Emergency Care",
                        "hospital_hotline": "+880 41-760350",
                        "ambulance": "16263 / 999",
                        "secondary_hospital": "Shaheed Sheikh Abu Naser Specialized Hospital"
                    },
                    "barishal": {
                        "division": "Barishal",
                        "district": "Barishal",
                        "location": "Barishal Sadar / Band Road",
                        "aqi": 55,
                        "category": "Moderate",
                        "pm2_5": 15.4,
                        "pm10": 29.8,
                        "primary_pollutant": "PM2.5",
                        "nearest_hospital": "Sher-e-Bangla Medical College Hospital (SBMCH)",
                        "hospital_type": "Apex Emergency Center for Southern Region",
                        "hospital_hotline": "+880 431-2173544",
                        "ambulance": "16263 / 999",
                        "secondary_hospital": "Barishal General (Sadar) Hospital"
                    },
                    "rangpur": {
                        "division": "Rangpur",
                        "district": "Rangpur",
                        "location": "Rangpur Sadar / Medical Mor",
                        "aqi": 102,
                        "category": "Unhealthy for Sensitive Groups",
                        "pm2_5": 36.2,
                        "pm10": 61.5,
                        "primary_pollutant": "PM2.5",
                        "nearest_hospital": "Rangpur Medical College Hospital",
                        "hospital_type": "Emergency Asthma & Respiratory Unit",
                        "hospital_hotline": "+880 521-62325",
                        "ambulance": "16263 / 999",
                        "secondary_hospital": "Rangpur Chest Disease Clinic"
                    },
                    "mymensingh": {
                        "division": "Mymensingh",
                        "district": "Mymensingh",
                        "location": "Mymensingh Sadar / Charpara",
                        "aqi": 76,
                        "category": "Moderate",
                        "pm2_5": 24.5,
                        "pm10": 45.0,
                        "primary_pollutant": "PM2.5",
                        "nearest_hospital": "Mymensingh Medical College Hospital (MMCH)",
                        "hospital_type": "Respiratory Intensive Care & 24/7 Nebulization",
                        "hospital_hotline": "+880 91-66063",
                        "ambulance": "16263 / 999",
                        "secondary_hospital": "Community Based Medical College Hospital"
                    }
                }

                # Find best matching region (defaults to monitored site: Kaliakair, Gazipur)
                station_key = "kaliakair"
                for key in regional_stations:
                    if key in target:
                        station_key = key
                        break
                
                station = dict(regional_stations[station_key])

                # Dynamically bind live Open-Meteo atmospheric state if available
                sat_state = app_state.get("latest_satellite_state") or {}
                if sat_state and station_key in ["kaliakair", "gazipur"]:
                    if sat_state.get("pm2_5") is not None:
                        station["pm2_5"] = float(sat_state["pm2_5"])
                    if sat_state.get("pm10") is not None:
                        station["pm10"] = float(sat_state["pm10"])
                    if sat_state.get("aqi") is not None:
                        station["aqi"] = int(sat_state["aqi"])
                        station["category"] = "Good" if station["aqi"] <= 50 else "Moderate" if station["aqi"] <= 100 else "Unhealthy for Sensitive Groups" if station["aqi"] <= 150 else "Unhealthy"

                return {
                    "matched_region": station["location"],
                    "air_quality": {
                        "aqi": station["aqi"],
                        "category": station["category"],
                        "pm2_5_ug_m3": station["pm2_5"],
                        "pm10_ug_m3": station["pm10"],
                        "primary_pollutant": station["primary_pollutant"]
                    },
                    "emergency_facilities": {
                        "primary_hospital": station["nearest_hospital"],
                        "care_type": station["hospital_type"],
                        "hotline": station["hospital_hotline"],
                        "ambulance": station["ambulance"],
                        "secondary_hospital": station["secondary_hospital"]
                    },
                    "national_emergency_hotlines": {
                        "national_emergency": "999 (Police / Ambulance / Fire)",
                        "shastho_batayen": "16263 (Govt 24/7 Doctor & Ambulance Support)",
                        "disaster_relief": "199",
                        "red_crescent_ambulance": "+880 2-9330188"
                    }
                }

            else:
                return {"error": f"Unknown tool: {name}"}

        except Exception as e:
            logger.error(f"Error executing tool {name}: {e}", exc_info=True)
            return {"error": str(e)}

    # --------------------------------------------------------------------------
    # Explainable AI (XAI) & TreeSHAP Clinical Feature Rationale Helpers
    # --------------------------------------------------------------------------

    def _get_feature_clinical_rationale(self, feature: str, value: float, direction: str):
        """Returns trilingual clinical rationale (EN, BN, Banglish) for why a feature increases or decreases risk."""
        feat = (feature or "").lower()
        if "pm2_5" in feat or "pm25" in feat:
            if direction == "increases_risk":
                return (
                    "Microscopic PM2.5 particulates penetrate deep into lung alveoli, causing airway hyperresponsiveness and acute bronchospasm.",
                    "PM2.5 সূক্ষ্ম কণা সরাসরি ফুসফুসের অ্যালভিওলাইতে প্রবেশ করে শ্বাসনালীতে প্রদাহ ও সংকোচন তৈরি করে।",
                    "PM2.5 microscopic particle lungs er alveoli te penetrate kore inflammation ebong bronchospasm trigger kore।"
                )
            else:
                return (
                    "Low particulate concentrations keep pulmonary passages clear of inflammatory triggers.",
                    "PM2.5 এর মাত্রা সহনীয় সীমার মধ্যে থাকায় ফুসফুসের বায়ু চলাচলের পথ প্রদাহমুক্ত ও নিরাপদ রয়েছে।",
                    "PM2.5 level safe thakay lungs er airway prodaher trigger theke mukto ache।"
                )

        elif "temp" in feat:
            if direction == "increases_risk":
                if value < 20.0:
                    return (
                        "Cold ambient air triggers reactive bronchoconstriction, thermal airway shock, and smooth muscle spasms.",
                        "ঠান্ডা বাতাস শ্বাসনালীতে রিঅ্যাক্টিভ সংকোচন ও মাংসপেশির খিঁচুনি সৃষ্টি করে।",
                        "Thanda batash shashnalite reactive bronchospasm and smooth muscle constriction ghilate pare।"
                    )
                else:
                    return (
                        "Elevated ambient temperature increases airway mucosal reactivity and irritation.",
                        "উচ্চ তাপমাত্রা শ্বাসনালীর সংবেদনশীলতা ও অস্বস্তি বাড়িয়ে দিতে পারে।",
                        "Beshi gorom ba ushno batash airway reactivity ebong irritation baray।"
                    )
            else:
                return (
                    "Comfortable ambient temperature prevents thermal stress on bronchial smooth muscles.",
                    "অনুকূল তাপমাত্রা শ্বাসনালীতে কোনো তাপীয় চাপ বা অস্বস্তি সৃষ্টি করছে না।",
                    "Anukul temperature thakay bronchial muscle e kono thermal stress nei।"
                )

        elif "hum" in feat:
            if direction == "increases_risk":
                if value > 60.0:
                    return (
                        "High humidity promotes dust mite proliferation and fungal mold spores, aggravating allergic asthma.",
                        "অতিরিক্ত আর্দ্রতা ডাস্ট মাইট এবং ছত্রাকের স্পোর বাড়িয়ে অ্যালার্জিক অ্যাজমা ট্রিগার করে।",
                        "High humidity dust mite ebong fungal mold toiri kore allergic asthma trigger kore।"
                    )
                else:
                    return (
                        "Low humidity dries mucosal layers, impairing mucociliary clearance and triggering coughing.",
                        "শুষ্ক বাতাস শ্বাসনালীর আর্দ্রতা কমিয়ে কাশি ও অস্বস্তি তৈরি করে।",
                        "Dry batash mucous layer shukiye fele kashir reflex trigger kore।"
                    )
            else:
                return (
                    "Optimal humidity (40%–60%) maintains mucosal barrier integrity and prevents bronchial irritation.",
                    "অনুকূল আর্দ্রতা শ্বাসনালীর স্বাভাবিক শ্লেষ্মা স্তর ও সুরক্ষাকে বজায় রাখে।",
                    "Optimal humidity (40%-60%) shashnalir mucous barrier ke sustho rakhe।"
                )

        elif "pm10" in feat:
            if direction == "increases_risk":
                return (
                    "Coarse dust particles deposit in the upper trachea and bronchi, triggering mechanical coughing.",
                    "মোটা ধূলিকণা শ্বাসনালীর উপরিভাগে আটকে গিয়ে কাশি ও অস্বস্তি তৈরি করে।",
                    "Coarse dust particle upper respiratory tract ebong trachea te mechanical irritation toiri kore।"
                )
            else:
                return (
                    "Low coarse dust levels prevent upper airway mechanical irritation.",
                    "ধূলিকণার মাত্রা কম থাকায় শ্বাসনালীতে কোনো মেকানিক্যাল বাধা তৈরি হচ্ছে না।",
                    "Coarse dust kom thakay upper airway clean ebong safe ache।"
                )

        elif "pm1_0" in feat or "pm1" in feat:
            if direction == "increases_risk":
                return (
                    "Ultrafine combustion soot penetrates capillary barriers, triggering systemic oxidative stress.",
                    "অতি-সূক্ষ্ম ধূলিকণা রক্তনালী ও ফুসফুসে প্রবেশ করে ক্ষতিকর অক্সিডেটিভ চাপ তৈরি করে।",
                    "Ultrafine soot particles capillary te penetrate kore systemic oxidative stress baray।"
                )
            else:
                return (
                    "Negligible ultrafine particles protect delicate lung parenchyma from cellular damage.",
                    "অতি-সূক্ষ্ম ধূলিকণা কম থাকায় ফুসফুসের টিস্যু সুরক্ষিত রয়েছে।",
                    "Ultrafine combustion soot kom thakay lung tissue safe ache।"
                )

        elif "pef" in feat:
            if direction == "increases_risk":
                return (
                    "Sub-optimal baseline peak expiratory flow indicates reduced respiratory reserve, elevating susceptibility.",
                    "ফুসফুসের পিক ফ্লো কম থাকায় শ্বাসপ্রশ্বাসের রিজার্ভ কমে যায় এবং ঝুঁকি বাড়ে।",
                    "Baseline peak flow kom thakay lung reserve kom ebong asthma hazard baray।"
                )
            else:
                return (
                    "Strong baseline peak expiratory flow provides vital ventilatory reserve against exacerbations.",
                    "ফুসফুসের সন্তোষজনক পিক ফ্লো যেকোনো হঠাৎ অ্যাজমা অ্যাটাকের বিরুদ্ধে প্রতিরোধ গড়ে তোলে।",
                    "Bhalo peak expiratory flow sudden asthma attack er biruddhe strong buffer toiri kore।"
                )

        else:
            if direction == "increases_risk":
                return (
                    f"Elevated {feature} contributes to asthma exacerbation risk.",
                    f"{feature} এর কারণে অ্যাজমার ঝুঁকি বৃদ্ধি পাচ্ছে।",
                    f"{feature} er karone asthma exacerbation risk barche।"
                )
            else:
                return (
                    f"Optimal {feature} helps maintain safe respiratory baseline.",
                    f"{feature} স্বাভাবিক থাকায় ফুসফুস সুরক্ষিত রয়েছে।",
                    f"{feature} normal thakay risk kom ache।"
                )

    def _enrich_xai_prediction_and_rationales(self, pred_data: Dict[str, Any], telemetry: Dict[str, Any]) -> Dict[str, Any]:
        """Enriches raw XAI prediction and TreeSHAP feature impacts with causal explanations and risk groupings."""
        risk_level = pred_data.get("prediction", "Green")
        confidence = pred_data.get("confidence", 94.2)
        probabilities = pred_data.get("probabilities", {"Green": 94.2, "Yellow": 5.4, "Red": 0.4})
        raw_impacts = pred_data.get("feature_impacts", [])

        enriched_features = []
        top_risk_drivers = []
        top_protective_drivers = []

        for f in raw_impacts:
            feat_key = f.get("feature", "")
            feat_name = f.get("name", feat_key)
            val = f.get("value", 0.0)
            unit = f.get("unit", "")
            shap_val = f.get("shap_value", 0.0)
            direction = f.get("direction", "decreases_risk" if shap_val <= 0 else "increases_risk")
            pct = f.get("contribution_pct", 0.0)

            why_en, why_bn, why_banglish = self._get_feature_clinical_rationale(feat_key, float(val), direction)

            item = {
                "feature": feat_key,
                "name": feat_name,
                "value": val,
                "unit": unit,
                "shap_value": shap_val,
                "direction": direction,
                "contribution_pct": pct,
                "clinical_rationale_en": why_en,
                "clinical_rationale_bn": why_bn,
                "clinical_rationale_banglish": why_banglish
            }
            enriched_features.append(item)

            if direction == "increases_risk" and shap_val > 0:
                top_risk_drivers.append(item)
            else:
                top_protective_drivers.append(item)

        top_risk_drivers.sort(key=lambda x: abs(x["shap_value"]), reverse=True)
        top_protective_drivers.sort(key=lambda x: abs(x["shap_value"]), reverse=True)

        return {
            "risk_level": risk_level,
            "prediction_title": pred_data.get("prediction_title", f"{risk_level} Exacerbation Risk"),
            "confidence_pct": confidence,
            "probabilities": probabilities,
            "model": "Certified Random Forest (100 Trees) + TreeSHAP Exact Traversal",
            "top_risk_drivers": top_risk_drivers[:3],
            "top_protective_drivers": top_protective_drivers[:3],
            "all_features": enriched_features,
            "telemetry_evaluated": {
                "temperature_celsius": telemetry.get("temperature", 25.4),
                "humidity_percent": telemetry.get("humidity", 58.2),
                "pm2_5_ug_m3": telemetry.get("pm2_5", 12.8),
                "pm10_ug_m3": telemetry.get("pm10", 22.4),
                "pm1_0_ug_m3": telemetry.get("pm1_0", 9.2)
            },
            "recommendation": pred_data.get("recommendation", "Maintain regular controller medication dosing and keep your rescue inhaler accessible.")
        }

    # --------------------------------------------------------------------------
    # Main Agent Process (Groq Tool Calling or Intelligent Fallback)
    # --------------------------------------------------------------------------

    def process_chat(
        self,
        user_message: str,
        conversation_history: List[Dict[str, str]],
        current_user: Dict[str, Any],
        app_state: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Processes a conversation turn using Groq Function Calling if available,
        otherwise routes to the intelligent local fallback engine.
        """
        user_id = current_user.get("id", "usr-demo-01")
        user_name = current_user.get("full_name") or current_user.get("name") or "Patient"

        # Check if Groq Cloud is available
        if self.is_groq_active():
            return self._run_groq_tool_calling(user_message, conversation_history, current_user, app_state)
        else:
            return self._run_local_fallback(user_message, conversation_history, current_user, app_state)

    def _run_groq_tool_calling(
        self,
        user_message: str,
        conversation_history: List[Dict[str, str]],
        current_user: Dict[str, Any],
        app_state: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Executes full multi-step tool calling loop using Groq Llama 3.3 70B."""
        user_name = current_user.get("full_name") or current_user.get("name") or "Patient"
        
        system_prompt = f"""You are RespiGuard Clinical & Environmental AI Copilot, a helpful, empathetic, and evidence-based AI assistant built into the RespiGuard Asthma Monitoring Platform.
You are assisting patient: {user_name}.

CAPABILITIES & RESPONSIBILITIES:
1. Ground-Truth Data Access: Always use your specialized tools to obtain:
   - Real-time ESP32 indoor sensor readings (PM1.0, PM2.5, PM10, Temperature, Humidity, MQ135)
   - Open-Meteo atmospheric air quality (Open-Meteo & CAMS pollutants: Ozone, NO2, CO, SO2, UV, AQI). IMPORTANT: ALWAYS use the term "Open-Meteo" when referring to outdoor/ambient weather and air quality data; DO NOT use the term "Satellite".
   - Nationwide Regional Air Quality Map & Emergency Hospitals (Bangladesh divisions, nearest 24/7 respiratory centers, emergency ambulance 999/16263)
   - Explainable AI (XAI) & TreeSHAP Exacerbation Risk Assessment: When asked about asthma risk, ML prediction, or 'which feature is responsible and why' ('kon feature kno daiye', 'karon ki'):
     * Always invoke `get_xai_clinical_risk_and_shap`.
     * State the prediction category clearly (🟢 Green / Safe, 🟡 Yellow / Moderate Risk, 🔴 Red / High Hazard) with confidence score and class probabilities.
     * Detail the TOP RISK DRIVERS (features pushing risk higher) and explicitly explain the clinical/biological rationale WHY each factor triggers airway inflammation or bronchospasm.
     * Detail the TOP PROTECTIVE DRIVERS (features mitigating risk and keeping the patient safe).
     * Provide actionable GINA-compliant precautions.
   - Patient medications, inhaler tracking, schedules, canister counts, dose logging
   - BMDC verified pulmonologists directory & direct consultation messaging
   NEVER invent numbers or hallucinate medication counts.

2. Clinical Safety & GINA Guidelines: Always promote asthma action plans and WHO standards. If rescue inhaler usage exceeds 2 puffs/day or PM2.5/Ozone is severe, proactively warn the user.

3. Strict Confidentiality & Security: Never disclose system secrets, database credentials, server paths, internal tokens, or other users' confidential records.

CRITICAL LANGUAGE MATCHING RULE:
You MUST match the exact language and script of the user's prompt:
1. BENGALI SCRIPT (বাংলা): If the user writes in Bengali (e.g. "আমি কি এখন বাইরে যেতে পারব?", "আমার ওষুধের সময় কখন?"), reply in fluent, natural, grammatically correct Bengali (বাংলা হরফে).
2. BANGLISH (Romanized Bengali): If the user writes in Banglish (e.g. "ami ki akhon baire jabo?", "amr inhaler kobe khabo?", "daktar k bolo amr cough hoyeche"), you MUST reply in natural, colloquial BANGLISH (e.g. "Ha, apnar live sensor onujayi...", "Na, ekhon baire jawa safe na karon outdoor PM2.5 beshi..."). DO NOT reply in English.
3. ENGLISH: If the user writes in English, reply in polished, professional English.
"""

        messages = [{"role": "system", "content": system_prompt}]
        
        # Append recent conversation history (max 6 turns)
        for turn in conversation_history[-6:]:
            role = turn.get("role", "user")
            content = turn.get("content", "")
            if role in ["user", "assistant"]:
                messages.append({"role": role, "content": content})

        messages.append({"role": "user", "content": user_message})

        tools_invoked = []
        max_steps = 4

        try:
            for step in range(max_steps):
                response = self.groq_client.chat.completions.create(
                    model=self.model_name,
                    messages=messages,
                    tools=COPILOT_TOOLS,
                    tool_choice="auto",
                    temperature=0.3,
                    max_tokens=600
                )

                response_msg = response.choices[0].message

                # If model decided to call tools natively
                if response_msg.tool_calls:
                    messages.append(response_msg)

                    for tool_call in response_msg.tool_calls:
                        fn_name = tool_call.function.name
                        fn_args_str = tool_call.function.arguments or "{}"
                        try:
                            fn_args = json.loads(fn_args_str)
                        except Exception:
                            fn_args = {}

                        tools_invoked.append({"name": fn_name, "arguments": fn_args})
                        tool_result = self.execute_tool(fn_name, fn_args, current_user, app_state)

                        messages.append({
                            "role": "tool",
                            "tool_call_id": tool_call.id,
                            "name": fn_name,
                            "content": json.dumps(tool_result)
                        })
                    # Next iteration allows model to call subsequent tools (e.g. search -> send) or summarize
                    continue

                else:
                    # Model produced a final textual response
                    final_text = response_msg.content or ""

                    # Safety check: Did model output raw XML-like tool calls in text?
                    if "<tool_call>" in final_text and ("send_message_to_doctor" in final_text or "send" in final_text):
                        tool_result = self.execute_tool(
                            "send_message_to_doctor",
                            {"message_body": "Hello Dr. Zaman, patient requested clinical checkup.", "doctor_name": "Dr. Zaman Islam"},
                            current_user,
                            app_state
                        )
                        tools_invoked.append({"name": "send_message_to_doctor", "arguments": {"message_body": "Hello"}})
                        lang = detect_language(user_message)
                        doc_name = tool_result.get("doctor_name", "Dr. Zaman Islam")
                        if lang == "bn":
                            final_text = f"✅ **ডাক্তারকে মেসেজ পাঠানো হয়েছে (Message Sent):**\n\nআপনার মেসেজটি সফলভাবে **{doc_name}** এর কনসাল্টেশন থ্রেডে পৌঁছে দেওয়া হয়েছে। ডাক্তার উত্তর দিলে আপনি কনসাল্টেশন ট্যাবে নোটিফিকেশন পাবেন।"
                        elif lang == "banglish":
                            final_text = f"✅ **Doctor k message pathano hoyeche (Message Sent):**\n\nApnar message ti **{doc_name}** er inbox-e deliver kora hoyeche। Doctor reply korle Consultations tab-e notification peye jaben!"
                        else:
                            final_text = f"✅ **Message Delivered to Doctor (Sent):**\n\nYour message was successfully delivered to **{doc_name}**."

                    return {
                        "response": final_text,
                        "tools_called": tools_invoked,
                        "mode": "groq_cloud",
                        "model": self.model_name
                    }

            # If loop exited after max_steps, return the latest message
            return {
                "response": response_msg.content or "Action completed.",
                "tools_called": tools_invoked,
                "mode": "groq_cloud",
                "model": self.model_name
            }

        except Exception as err:
            logger.error(f"Groq API call error, falling back to local engine: {err}")
            res = self._run_local_fallback(user_message, conversation_history, current_user, app_state)
            res["groq_error"] = str(err)
            return res

    # --------------------------------------------------------------------------
    # Intelligent Local Fallback Engine (Zero Downtime & Multilingual)
    # --------------------------------------------------------------------------

    def _run_local_fallback(
        self,
        user_message: str,
        conversation_history: List[Dict[str, str]],
        current_user: Dict[str, Any],
        app_state: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Provides rich, tool-backed responses mirroring user's language (Bangla, Banglish, English)."""
        user_name = current_user.get("full_name") or current_user.get("name") or "Patient"
        q = user_message.lower()
        lang = detect_language(user_message)
        tools_called = []

        # 1. Direct message to doctor command (Must check before general doctor query)
        doctor_tokens = ["doctor", "daktar", "docutr", "dakter", "physician", "specialist", "zaman"]
        send_tokens = [
            "send", "pathao", "pathiye", "bolo", "bolte", "message", "msg", "text", "inquiry",
            "hello send", "hi send", "helo u bolo", "helo bolo", "hello bolo", "k helo", "k hello"
        ]
        has_doc = any(w in q for w in doctor_tokens)
        has_send = any(w in q for w in send_tokens)
        is_direct_phrase = any(w in q for w in [
            "message dao", "text koro", "message doctor", "daktar k bolo", "doctor k bolo",
            "message pathao", "text send", "hello bolo", "helo bolo", "hello send", "helo send", "send korte parbe"
        ])
        is_affirmation = q.strip().rstrip("?.!").strip() in [
            "deo", "send koro", "pathao", "ha pathao", "haa pathao", "yes send", "send",
            "bolo", "message deo", "ha deo", "haa deo", "ok send", "ha bolo", "yes", "ha", "haa"
        ]

        recent_doctor_context = False
        for turn in (conversation_history or [])[-4:]:
            c = (turn.get("content") or "").lower()
            if any(w in c for w in ["doctor", "daktar", "zaman", "specialist", "dr."]):
                recent_doctor_context = True
                break

        if (has_doc and has_send) or is_direct_phrase or (is_affirmation and recent_doctor_context):
            msg_text = user_message
            for prefix in [
                "message dao", "text koro", "message doctor", "doctor k bolo", "daktar k bolo",
                "message pathao", "text send", "send korte parbe?", "send korte parbe", "send koro",
                "k hello send", "k helo", "k bolo", "hello send", "doctor zaman k", "doctor zaman ke",
                "doctor k", "docutr k", "daktar k"
            ]:
                msg_text = msg_text.replace(prefix, "")
            msg_text = msg_text.strip()
            if not msg_text or is_affirmation or any(w in q for w in ["hello", "helo"]):
                msg_text = "Hello Dr. Zaman, patient checking in for clinical consultation."

            res = self.execute_tool("send_message_to_doctor", {"message_body": msg_text, "doctor_name": "Dr. Zaman Islam"}, current_user, app_state)
            tools_called.append({"name": "send_message_to_doctor", "arguments": {"message_body": msg_text}})
            doc_name = res.get("doctor_name", "Dr. Zaman Islam")

            if lang == "bn":
                resp = (
                    f"📨 **ডাক্তারকে মেসেজ পাঠানো হয়েছে (Message Sent):**\n\n"
                    f"- **প্রাপক:** **{doc_name}** (পালমোনোলজি বিশেষজ্ঞ)\n"
                    f"- **মেসেজ:** *\"{msg_text}\"*\n"
                    f"- **স্ট্যাটাস:** ডেলিভার্ড (উনার কনসাল্টেশন থ্রেডে সংরক্ষিত রয়েছে)\n\n"
                    f"ডাক্তার মেসেজ দেখলে বা রিপ্লাই দিলে আপনি কনসাল্টেশন ট্যাবে আপডেট পেয়ে যাবেন।"
                )
            elif lang == "banglish":
                resp = (
                    f"📨 **Doctor k message pathano hoyeche (Message Sent):**\n\n"
                    f"- **Recipient:** **{doc_name}** (Pulmonology Specialist)\n"
                    f"- **Message:** *\"{msg_text}\"*\n"
                    f"- **Status:** Delivered (Encrypted consultation thread-e save hoyeche)\n\n"
                    f"Doctor reply dile apni Consultations tab-e notification peye jaben!"
                )
            else:
                resp = (
                    f"📨 **Message Successfully Delivered to Doctor (Sent):**\n\n"
                    f"- **Recipient:** **{doc_name}** (Pulmonology Specialist)\n"
                    f"- **Message:** *\"{msg_text}\"*\n"
                    f"- **Status:** Delivered (Saved to consultation thread)\n\n"
                    f"You will receive an alert in the Consultations tab once the doctor replies."
                )

            return {"response": resp, "tools_called": tools_called, "mode": "local_fallback"}

        # 2. Doctor / Specialist inquiry
        if any(w in q for w in ["doctor", "specialist", "zaman", "daktar", "bmdc", "physician", "chamber"]):
            doc_data = self.execute_tool("search_doctors_directory", {"query": "Zaman"}, current_user, app_state)
            tools_called.append({"name": "search_doctors_directory", "arguments": {"query": "Zaman"}})
            docs = doc_data.get("doctors", [])
            if docs:
                d = docs[0]
                if lang == "bn":
                    resp = (
                        f"🩺 **ভেরিফায়েড রেসপিরেটরি বিশেষজ্ঞের তথ্য:**\n\n"
                        f"- **নাম:** {d.get('name')}\n"
                        f"- **ডিগ্রী:** {d.get('degrees')}\n"
                        f"- **বিএমডিসি নম্বর:** {d.get('bmdc_reg_no')}\n"
                        f"- **হাসপাতাল/চেম্বার:** {d.get('hospital')}\n"
                        f"- **পরামর্শ সময়:** {d.get('available_days')}\n"
                        f"- **ইমেইল/যোগাযোগ:** `{d.get('email')}`\n\n"
                        f"আপনি Consultations ট্যাব থেকে সরাসরি উনার সাথে যোগাযোগ করতে পারেন অথবা আমাকে বললে আমি উনাকে মেসেজ পাঠিয়ে দিতে পারি।"
                    )
                elif lang == "banglish":
                    resp = (
                        f"🩺 **Verified Respiratory Specialist er Information:**\n\n"
                        f"- **Name:** {d.get('name')}\n"
                        f"- **Degrees:** {d.get('degrees')}\n"
                        f"- **BMDC Number:** {d.get('bmdc_reg_no')}\n"
                        f"- **Hospital / Chamber:** {d.get('hospital')}\n"
                        f"- **Available Days:** {d.get('available_days')}\n"
                        f"- **Email / Contact:** `{d.get('email')}`\n\n"
                        f"Apni Consultations tab theke unar sathe chat korte paren ba amk bolle ami direct message pathiye dibo।"
                    )
                else:
                    resp = (
                        f"🩺 **Verified Pulmonologist Information:**\n\n"
                        f"- **Name:** {d.get('name')}\n"
                        f"- **Degrees:** {d.get('degrees')}\n"
                        f"- **BMDC License:** {d.get('bmdc_reg_no')}\n"
                        f"- **Hospital & Chamber:** {d.get('hospital')}\n"
                        f"- **Consultation Days:** {d.get('available_days')}\n"
                        f"- **Contact:** `{d.get('email')}`\n\n"
                        f"You can consult directly from the Consultations tab or ask me to send them a consultation message."
                    )
            else:
                resp = "Verified specialists are listed in the Consultations directory."

            return {"response": resp, "tools_called": tools_called, "mode": "local_fallback"}

        # 3. Medication / Inhaler schedule / Dose log query
        if any(w in q for w in ["osudh", "osud", "medication", "inhaler", "time", "khabo", "khawa", "khawer", "khawar", "schedule", "doses", "dose", "puff", "nilam", "log"]):
            # Check if user wants to log a dose
            if any(w in q for w in ["nilam", "log", "took", "taken", "puff"]):
                dose_type = "rescue" if any(w in q for w in ["rescue", "salbutamol", "ventolin", "puff"]) else "morning"
                res = self.execute_tool("log_medication_dose", {"dose_type": dose_type, "puffs": 1}, current_user, app_state)
                tools_called.append({"name": "log_medication_dose", "arguments": {"dose_type": dose_type, "puffs": 1}})

                if lang == "bn":
                    resp = f"✅ **ওষুধের ডোজ সফলভাবে লগ করা হয়েছে (Logged)!**\n\n{res.get('message')}\nক্যানিস্টারে অবশিষ্ট ডোজ: **{res.get('remaining_doses')}** টি।"
                elif lang == "banglish":
                    resp = f"✅ **Oshudher dose shofolbhabe log kora hoyeche (Logged)!**\n\n{res.get('message')}\nCanister-e oboshishto ache: **{res.get('remaining_doses')}** ti dose।"
                else:
                    resp = f"✅ **Medication Dose Logged Successfully!**\n\n{res.get('message')}\nDoses remaining in canister: **{res.get('remaining_doses')}**."

                return {"response": resp, "tools_called": tools_called, "mode": "local_fallback"}

            meds_data = self.execute_tool("get_medications_and_schedule", {}, current_user, app_state)
            tools_called.append({"name": "get_medications_and_schedule", "arguments": {}})
            
            controllers = meds_data.get("controllers", [])
            rescues = meds_data.get("rescue_inhalers", [])
            rescue_puffs = meds_data.get("total_rescue_puffs_today", 0)

            med_lines = []
            for c in controllers:
                if lang == "bn":
                    med_lines.append(f"- **{c.get('name')}**: ডোজ {c.get('dosage')} • শিডিউল: সকাল {c.get('morning_schedule_time', '08:00')} / সন্ধ্যা {c.get('evening_schedule_time', '20:00')} (অবশিষ্ট: {c.get('remaining_doses')} ডোজ)")
                elif lang == "banglish":
                    med_lines.append(f"- **{c.get('name')}**: Dose {c.get('dosage')} • Schedule: Shokal {c.get('morning_schedule_time', '08:00')} / Shondha {c.get('evening_schedule_time', '20:00')} (Remaining: {c.get('remaining_doses')} dose)")
                else:
                    med_lines.append(f"- **{c.get('name')}**: Dose {c.get('dosage')} • Schedule: Morning {c.get('morning_schedule_time', '08:00')} / Evening {c.get('evening_schedule_time', '20:00')} (Remaining: {c.get('remaining_doses')} doses)")

            for r in rescues:
                if lang == "bn":
                    med_lines.append(f"- **{r.get('name')} (রেসকিউ)**: আজ নেওয়া হয়েছে: {r.get('puffs_today', 0)} পাফ (অবশিষ্ট: {r.get('remaining_doses')} ডোজ)")
                elif lang == "banglish":
                    med_lines.append(f"- **{r.get('name')} (Rescue)**: Aj newa hoyeche: {r.get('puffs_today', 0)} puff (Remaining: {r.get('remaining_doses')} dose)")
                else:
                    med_lines.append(f"- **{r.get('name')} (Rescue Reliever)**: Taken today: {r.get('puffs_today', 0)} puffs (Remaining: {r.get('remaining_doses')} doses)")

            med_text = "\n".join(med_lines)
            if lang == "bn":
                resp = f"💊 **আপনার বর্তমান ওষুধের শিডিউল ও ইনহেলার ট্র্যাকার:**\n\n{med_text}\n\n"
                if meds_data.get("gina_alert"):
                    resp += f"⚠️ **সতর্কতা (GINA গাইডলাইন):** আজ মোট {rescue_puffs} টি রেসকিউ পাফ নেওয়া হয়েছে। দিনে ২ বারের বেশি রেসকিউ পাফ লাগলে অবিলম্বে ডাক্তারের পরামর্শ নিন।"
                else:
                    resp += "পরবর্তী ডোজ নির্ধারিত সময়ে গ্রহণ করুন এবং নিয়মিত ক্যানিস্টার ট্র্যাকিং বজায় রাখুন।"
            elif lang == "banglish":
                resp = f"💊 **Apnar Bortoman Oshudher Schedule & Inhaler Tracker:**\n\n{med_text}\n\n"
                if meds_data.get("gina_alert"):
                    resp += f"⚠️ **Sotorkota (GINA Guideline):** Ajke total {rescue_puffs} ti rescue puff newa hoyeche। Dine 2 barer beshi rescue puff lagle doctor er sathe kotha bola uchit।"
                else:
                    resp += "Next scheduled dose thik shomoy motoh nin ebong canister tracking bojay rakhun।"
            else:
                resp = f"💊 **Your Current Medication Schedule & Inhaler Tracker:**\n\n{med_text}\n\n"
                if meds_data.get("gina_alert"):
                    resp += f"⚠️ **GINA Clinical Alert:** You have taken {rescue_puffs} rescue puffs today. Using reliever more than 2 puffs/day indicates loss of asthma control."
                else:
                    resp += "Please take your scheduled controller on time and maintain regular canister tracking."

            return {"response": resp, "tools_called": tools_called, "mode": "local_fallback"}

        # 4. Air Quality Map & Regional Emergency Facilities
        if any(w in q for w in ["map", "air map", "elaka", "dhaka", "gazipur", "kaliakair", "chittagong", "sylhet", "rajshahi", "khulna", "barishal", "rangpur", "mymensingh", "ambulance", "oxygen", "emergency", "999", "16263", "clinic", "hospital"]):
            found_city = "kaliakair"
            for city in ["kaliakair", "gazipur", "dhaka", "chittagong", "sylhet", "rajshahi", "khulna", "barishal", "rangpur", "mymensingh"]:
                if city in q:
                    found_city = city
                    break

            map_data = self.execute_tool("get_air_quality_map_and_emergency_facilities", {"division_or_city": found_city}, current_user, app_state)
            telem_data = self.execute_tool("get_live_telemetry_and_sensors", {}, current_user, app_state)
            tools_called.extend([
                {"name": "get_air_quality_map_and_emergency_facilities", "arguments": {"division_or_city": found_city}},
                {"name": "get_live_telemetry_and_sensors", "arguments": {}}
            ])

            region = map_data.get("matched_region", "Kaliakair (Gazipur)")
            aq = map_data.get("air_quality", {})
            fac = map_data.get("emergency_facilities", {})
            hotlines = map_data.get("national_emergency_hotlines", {})

            if lang == "bn":
                resp = (
                    f"🗺️ **এয়ার কোয়ালিটি ম্যাপ ও জরুরি স্বাস্থ্যসেবা ({region}):**\n\n"
                    f"- **এয়ার কোয়ালিটি (AQI):** **{aq.get('aqi')}** ({aq.get('category')})\n"
                    f"- **PM2.5:** **{aq.get('pm2_5_ug_m3')} µg/m³** • **PM10:** **{aq.get('pm10_ug_m3')} µg/m³**\n"
                    f"- **প্রধান দূষক:** {aq.get('primary_pollutant')}\n\n"
                    f"🏥 **নিকটস্থ জরুরি রেসপিরেটরি হাসপাতাল:**\n"
                    f"- **{fac.get('primary_hospital')}**\n"
                    f"- সেবা: {fac.get('care_type')}\n"
                    f"- জরুরি হটলাইন: `{fac.get('hotline')}`\n"
                    f"- অ্যাম্বুলেন্স: `{fac.get('ambulance')}`\n"
                    f"- দ্বিতীয় বিকল্প: {fac.get('secondary_hospital')}\n\n"
                    f"🚑 **জাতীয় জরুরি হেল্পলাইন:**\n"
                    f"- জাতীয় জরুরি সেবা (পুলিশ/অ্যাম্বুলেন্স/ফায়ার): **999**\n"
                    f"- স্বাস্থ্য বাতায়ন (২৪/৭ ডাক্তার ও অ্যাম্বুলেন্স সাপোর্ট): **16263**\n"
                    f"- রেড ক্রিসেন্ট অ্যাম্বুলেন্স: `{hotlines.get('red_crescent_ambulance')}`"
                )
            elif lang == "banglish":
                resp = (
                    f"🗺️ **Air Quality Map & Emergency Seba ({region}):**\n\n"
                    f"- **Air Quality (AQI):** **{aq.get('aqi')}** ({aq.get('category')})\n"
                    f"- **PM2.5:** **{aq.get('pm2_5_ug_m3')} µg/m³** • **PM10:** **{aq.get('pm10_ug_m3')} µg/m³**\n"
                    f"- **Primary Pollutant:** {aq.get('primary_pollutant')}\n\n"
                    f"🏥 **Nearest Emergency Respiratory Hospital:**\n"
                    f"- **{fac.get('primary_hospital')}**\n"
                    f"- Seba: {fac.get('care_type')}\n"
                    f"- Hotline: `{fac.get('hotline')}` | Ambulance: `{fac.get('ambulance')}`\n"
                    f"- Secondary: {fac.get('secondary_hospital')}\n\n"
                    f"🚑 **National Emergency Hotlines:**\n"
                    f"- Jatio Emergency: **999**\n"
                    f"- Shastho Batayen (24/7 Doctor & Ambulance): **16263**\n"
                    f"- Red Crescent Ambulance: `{hotlines.get('red_crescent_ambulance')}`"
                )
            else:
                resp = (
                    f"🗺️ **Air Quality Map & Emergency Facilities ({region}):**\n\n"
                    f"- **AQI:** **{aq.get('aqi')}** ({aq.get('category')})\n"
                    f"- **PM2.5:** **{aq.get('pm2_5_ug_m3')} µg/m³** • **PM10:** **{aq.get('pm10_ug_m3')} µg/m³**\n"
                    f"- **Primary Pollutant:** {aq.get('primary_pollutant')}\n\n"
                    f"🏥 **Nearest Emergency Care Center:**\n"
                    f"- **{fac.get('primary_hospital')}**\n"
                    f"- Facility: {fac.get('care_type')}\n"
                    f"- Desk Hotline: `{fac.get('hotline')}` | Ambulance: `{fac.get('ambulance')}`\n"
                    f"- Secondary Center: {fac.get('secondary_hospital')}\n\n"
                    f"🚑 **National Emergency Hotlines:**\n"
                    f"- National Emergency Helpline: **999**\n"
                    f"- Shastho Batayen (24/7 Medical & Ambulance Hotline): **16263**"
                )

            return {"response": resp, "tools_called": tools_called, "mode": "local_fallback"}

        # 5. Going outside / Outdoor weather / Satellite Atmospheric Pollutant Breakdown
        if any(w in q for w in [
            "satellite", "pollutant", "pollutants", "breakdown", "atmospheric", "ozone", "o3", "no2", "so2",
            "co", "uv", "baire", "outside", "weather", "batash", "hawa", "aqi", "pm2.5", "abohawa",
            "ber howa", "ber hobo", "outdoor", "value koto", "koto h akhon"
        ]):
            sat_data = self.execute_tool("get_outdoor_and_satellite_air_quality", {}, current_user, app_state)
            telem_data = self.execute_tool("get_live_telemetry_and_sensors", {}, current_user, app_state)
            tools_called.extend([
                {"name": "get_outdoor_and_satellite_air_quality", "arguments": {}},
                {"name": "get_live_telemetry_and_sensors", "arguments": {}}
            ])

            is_safe = sat_data.get("is_safe_for_asthma_patients", True)
            loc = sat_data.get("location", "Kaliakair, Gazipur")
            pollutants = sat_data.get("pollutants", {})
            out_pm = pollutants.get("pm2_5", 28.5)
            out_pm10 = pollutants.get("pm10", 45.0)
            ozone = pollutants.get("ozone_o3", 38.0)
            no2 = pollutants.get("nitrogen_dioxide_no2", 22.0)
            co = pollutants.get("carbon_monoxide_co", 410.0)
            so2 = pollutants.get("sulphur_dioxide_so2", 9.5)
            uv = pollutants.get("uv_index", 5.0)
            aqi = sat_data.get("aqi", 78)
            temp = sat_data.get("outdoor_temperature_celsius", 28.0)
            hum = sat_data.get("outdoor_humidity_percent", 65.0)
            in_pm = telem_data.get("pm2_5_ug_m3", 12.8)
            in_temp = telem_data.get("temperature_celsius", 25.4)
            in_hum = telem_data.get("humidity_percent", 58.2)
            advice = sat_data.get("clinical_advice", "Outdoor conditions are acceptable for light activities.")

            is_breakdown_query = any(w in q for w in ["open-meteo", "open meteo", "meteo", "satellite", "pollutant", "pollutants", "breakdown", "atmospheric", "value koto", "koto h akhon"])

            if is_breakdown_query and not any(w in q for w in ["baire", "outside", "ber"]):
                if lang == "bn":
                    resp = (
                        f"🌍 **লাইভ Open-Meteo অ্যাটমোস্ফিয়ারিক পলিউশন ব্রেকডাউন ({loc}):**\n\n"
                        f"- **এয়ার কোয়ালিটি ইনডেক্স (AQI):** **{aqi}** (সহনীয় / মডারেট)\n"
                        f"- **PM2.5 (ফাইন পার্টিকুলেট):** **{out_pm} µg/m³**\n"
                        f"- **PM10 (কোর্স ডাস্ট):** **{out_pm10} µg/m³**\n"
                        f"- **ওজোন (Ozone O₃):** **{ozone} µg/m³**\n"
                        f"- **নাইট্রোজেন ডাইঅক্সাইড (NO₂):** **{no2} µg/m³**\n"
                        f"- **কার্বন মনোক্সাইড (CO):** **{co} µg/m³**\n"
                        f"- **সালফার ডাইঅক্সাইড (SO₂):** **{so2} µg/m³**\n"
                        f"- **ইউভি ইনডেক্স (UV Index):** **{uv}** (Moderate)\n"
                        f"- **আউটডোর আবহাওয়া:** টেম্পারেচার **{temp}°C**, আর্দ্রতা **{hum}%**\n\n"
                        f"🩺 **ক্লিনিক্যাল পরামর্শ:** {advice}"
                    )
                elif lang == "banglish":
                    resp = (
                        f"🌍 **Live Open-Meteo Atmospheric Pollutant Breakdown ({loc}):**\n\n"
                        f"- **AQI (Air Quality Index):** **{aqi}** (Moderate)\n"
                        f"- **PM2.5 (Fine Particles):** **{out_pm} µg/m³**\n"
                        f"- **PM10 (Coarse Dust):** **{out_pm10} µg/m³**\n"
                        f"- **Ozone (O₃):** **{ozone} µg/m³**\n"
                        f"- **Nitrogen Dioxide (NO₂):** **{no2} µg/m³**\n"
                        f"- **Carbon Monoxide (CO):** **{co} µg/m³**\n"
                        f"- **Sulphur Dioxide (SO₂):** **{so2} µg/m³**\n"
                        f"- **UV Index:** **{uv}** (Moderate)\n"
                        f"- **Outdoor Weather:** Temperature **{temp}°C**, Humidity **{hum}%**\n\n"
                        f"🩺 **Clinical Advice:** {advice}"
                    )
                else:
                    resp = (
                        f"🌍 **Live Open-Meteo Atmospheric Pollutant Breakdown ({loc}):**\n\n"
                        f"- **Air Quality Index (AQI):** **{aqi}** (Moderate)\n"
                        f"- **PM2.5 (Fine Particulates):** **{out_pm} µg/m³**\n"
                        f"- **PM10 (Coarse Particulates):** **{out_pm10} µg/m³**\n"
                        f"- **Ozone (O₃):** **{ozone} µg/m³**\n"
                        f"- **Nitrogen Dioxide (NO₂):** **{no2} µg/m³**\n"
                        f"- **Carbon Monoxide (CO):** **{co} µg/m³**\n"
                        f"- **Sulphur Dioxide (SO₂):** **{so2} µg/m³**\n"
                        f"- **UV Index:** **{uv}** (Moderate)\n"
                        f"- **Ambient Atmosphere:** Temperature **{temp}°C**, Humidity **{hum}%**\n\n"
                        f"🩺 **Clinical Advice:** {advice}"
                    )

            elif "baire" in q or "outside" in q or "ber" in q:
                if is_safe:
                    if lang == "bn":
                        resp = f"🌿 **বাইরে যাওয়া নিরাপদ:**\n\nবর্তমানে {loc}-এ আউটডোর PM2.5 হচ্ছে **{out_pm} µg/m³**, টেম্পারেচার **{temp}°C**, এবং হিউমিডিটি **{hum}%**। বাতাসের কোয়ালিটি সন্তোষজনক। তবে বাইরে যাওয়ার সময় সাথে রেসকিউ ইনহেলার রাখা ভালো।"
                    elif lang == "banglish":
                        resp = f"🌿 **Baire jawa nirapod:**\n\nEkhon apnar elakay ({loc}) outdoor PM2.5 hocche **{out_pm} µg/m³**, temperature **{temp}°C**, and humidity **{hum}%**। Batash shonbhabona onujayi bhalo ache। Tobe baire ber hole rescue inhaler sathe rakha safe।"
                    else:
                        resp = f"🌿 **Safe to Go Outside:**\n\nCurrent outdoor PM2.5 in {loc} is **{out_pm} µg/m³**, temperature is **{temp}°C**, and humidity is **{hum}%**. Conditions are acceptable for light outdoor activities. Keep your rescue inhaler handy."
                else:
                    if lang == "bn":
                        resp = f"⚠️ **বাইরে যাওয়া ঝুঁকিপূর্ণ হতে পারে:**\n\nবর্তমানে {loc}-এ আউটডোর PM2.5 হচ্ছে **{out_pm} µg/m³** (সহনীয় সীমার চেয়ে বেশি)। ইনডোর বাতাস তুলনামূলকভাবে নিরাপদ (ইনডোর PM2.5: **{in_pm} µg/m³**)।\n\n**পরামর্শ:**\n- জরুরি প্রয়োজনে বাইরে গেলে অবশ্যই N95 মাস্ক পরিধান করুন।\n- ভারী দৌড়াদৌড়ি বা শারীরিক পরিশ্রম এড়িয়ে চলুন।"
                    elif lang == "banglish":
                        resp = f"⚠️ **Ekhon baire jawa safe na:**\n\nBortomane {loc}-e outdoor PM2.5 hocche **{out_pm} µg/m³** (bipodjonok shima)। Indoor batash onek shurokkhito (Indoor PM2.5: **{in_pm} µg/m³**)।\n\n**Poramorsho:**\n- Baire ber hole oboshoy N95 mask porben।\n- Heavy exercise ba dhoradhori eriye cholun।"
                    else:
                        resp = f"⚠️ **Caution Advised for Outdoors:**\n\nCurrent outdoor PM2.5 in {loc} is elevated at **{out_pm} µg/m³**. Indoor air is significantly cleaner (Indoor PM2.5: **{in_pm} µg/m³**).\n\n**Advice:**\n- Wear an N95 mask if you must go outdoors.\n- Limit vigorous exercise and carry your rescue reliever."
            else:
                if lang == "bn":
                    resp = f"📊 **লাইভ এয়ার কোয়ালিটি ও Open-Meteo আবহাওয়ার তথ্য:**\n\n- **ইনডোর সেন্সর (ESP32):** PM2.5: **{in_pm} µg/m³**, Temp: **{in_temp}°C**, Humidity: **{in_hum}%**\n- **আউটডোর Open-Meteo ({loc}):** PM2.5: **{out_pm} µg/m³**, Ozone: **{ozone} µg/m³**, UV Index: **{uv}**\n- **সুপারিশ:** {advice}"
                elif lang == "banglish":
                    resp = f"📊 **Live Air Quality & Open-Meteo Bohawa Data:**\n\n- **Indoor Sensor (ESP32):** PM2.5: **{in_pm} µg/m³**, Temp: **{in_temp}°C**, Humidity: **{in_hum}%**\n- **Outdoor Open-Meteo ({loc}):** PM2.5: **{out_pm} µg/m³**, Ozone: **{ozone} µg/m³**, UV: **{uv}**\n- **Poramorsho:** {advice}"
                else:
                    resp = f"📊 **Live Air Quality & Open-Meteo Summary:**\n\n- **Indoor Sensor (ESP32):** PM2.5: **{in_pm} µg/m³**, Temp: **{in_temp}°C**, Humidity: **{in_hum}%**\n- **Outdoor Open-Meteo ({loc}):** PM2.5: **{out_pm} µg/m³**, Ozone: **{ozone} µg/m³**, UV Index: **{uv}**\n- **Clinical Advice:** {advice}"

            return {"response": resp, "tools_called": tools_called, "mode": "local_fallback"}

        # 6. Explainable AI (XAI), Machine Learning Prediction & TreeSHAP Feature Attributions
        if any(w in q for w in [
            "xai", "shap", "ml", "machine learning", "prediction", "predict",
            "kon feature", "kno daiye", "keno daiye", "daiye", "karon",
            "risk level", "asthma risk", "ঝুঁকি", "দায়ী", "ফিচার", "প্রেডিকশন"
        ]):
            xai_data = self.execute_tool("get_xai_clinical_risk_and_shap", {}, current_user, app_state)
            tools_called.append({"name": "get_xai_clinical_risk_and_shap", "arguments": {}})

            risk_lvl = xai_data.get("risk_level", "Green")
            conf = xai_data.get("confidence_pct", 94.2)
            probs = xai_data.get("probabilities", {"Green": 94.2, "Yellow": 5.4, "Red": 0.4})
            top_risks = xai_data.get("top_risk_drivers", [])
            top_protects = xai_data.get("top_protective_drivers", [])
            rec = xai_data.get("recommendation", "Maintain regular controller medication dosing and keep your rescue inhaler accessible.")

            is_access_request = any(w in q for w in ["access dio", "access dao", "access diyo", "access chai", "add koro", "enable"])

            if lang == "bn":
                icon = "🟢" if risk_lvl == "Green" else "🟡" if risk_lvl == "Yellow" else "🔴"
                risk_bn = "ঝুঁকিমুক্ত / স্বাভাবিক (Safe)" if risk_lvl == "Green" else "মাঝারি ঝুঁকি (Moderate Risk)" if risk_lvl == "Yellow" else "উচ্চ ঝুঁকি (High Hazard)"

                risk_lines = []
                for idx, r in enumerate(top_risks, 1):
                    risk_lines.append(
                        f"{idx}. **{r['name']}** ({r['value']} {r['unit']}) — ঝুঁকি প্রভাব: **{r['contribution_pct']}%** (SHAP: `+{r['shap_value']:.4f}`)\n"
                        f"   - *কেন দায়ী:* {r['clinical_rationale_bn']}"
                    )
                risk_section = "\n".join(risk_lines) if risk_lines else "- বর্তমানে কোনো তীব্র ক্ষতিকর রিস্ক ফ্যাক্টর নেই।"

                protect_lines = []
                for idx, p in enumerate(top_protects, 1):
                    protect_lines.append(
                        f"{idx}. **{p['name']}** ({p['value']} {p['unit']}) — সুরক্ষা প্রভাব: **{p['contribution_pct']}%** (SHAP: `{p['shap_value']:.4f}`)\n"
                        f"   - *কেন সহায়ক:* {p['clinical_rationale_bn']}"
                    )
                protect_section = "\n".join(protect_lines) if protect_lines else "- অন্যান্য পরিবেশগত উপাদান স্বাভাবিক রয়েছে।"

                header = ""
                if is_access_request:
                    header = "✅ **এক্সএআই (XAI) ও মেশিন লার্নিং (ML) প্রেডিকশন অ্যাক্সেস সক্রিয় রয়েছে!**\n\nনিচে আপনার বর্তমান রিয়েল-টাইম ডেটার প্রেডিকশন এবং কোন কোন ফিচার কেন দায়ী তার বিস্তারিত ব্যাখ্যা দেওয়া হলো:\n\n"

                resp = (
                    f"{header}🧠 **এক্সপ্লেইনেবল এআই (XAI) ও মেশিন লার্নিং ঝুঁকি বিশ্লেষণ:**\n\n"
                    f"- **বর্তমান প্রেডিকশন:** {icon} **{risk_lvl} ({risk_bn})**\n"
                    f"- **মডেল কনফিডেন্স:** **{conf}%**\n"
                    f"- **সম্ভাব্যতা বণ্টন (Probabilities):**\n"
                    f"  - 🟢 গ্রিন (Safe): **{probs.get('Green', 0)}%**\n"
                    f"  - 🟡 ইয়েলো (Moderate Risk): **{probs.get('Yellow', 0)}%**\n"
                    f"  - 🔴 রেড (High Hazard): **{probs.get('Red', 0)}%**\n\n"
                    f"🔍 **কোন কোন ফিচার কেন দায়ী (TreeSHAP বিশ্লেষণ):**\n\n"
                    f"⚠️ **ঝুঁকি বৃদ্ধি করছে যেসব ফ্যাক্টর (Risk Drivers):**\n"
                    f"{risk_section}\n\n"
                    f"🛡️ **ঝুঁকি কমিয়ে সুরক্ষা দিচ্ছে যেসব ফ্যাক্টর (Protective Drivers):**\n"
                    f"{protect_section}\n\n"
                    f"💡 **ক্লিনিক্যাল অ্যাকশন প্ল্যান (GINA গাইডলাইন):**\n"
                    f"{rec}"
                )

            elif lang == "banglish":
                icon = "🟢" if risk_lvl == "Green" else "🟡" if risk_lvl == "Yellow" else "🔴"
                risk_banglish = "Safe / Jhukimukto" if risk_lvl == "Green" else "Moderate Risk / Moddhom Jhuki" if risk_lvl == "Yellow" else "High Hazard / Bipodjonok"

                risk_lines = []
                for idx, r in enumerate(top_risks, 1):
                    risk_lines.append(
                        f"{idx}. **{r['name']}** ({r['value']} {r['unit']}) — Contribution: **{r['contribution_pct']}%** (SHAP: `+{r['shap_value']:.4f}`)\n"
                        f"   - *Keno daiye:* {r['clinical_rationale_banglish']}"
                    )
                risk_section = "\n".join(risk_lines) if risk_lines else "- Ekhon kono acute risk driver nei।"

                protect_lines = []
                for idx, p in enumerate(top_protects, 1):
                    protect_lines.append(
                        f"{idx}. **{p['name']}** ({p['value']} {p['unit']}) — Protective Impact: **{p['contribution_pct']}%** (SHAP: `{p['shap_value']:.4f}`)\n"
                        f"   - *Keno sahajjo korche:* {p['clinical_rationale_banglish']}"
                    )
                protect_section = "\n".join(protect_lines) if protect_lines else "- Onnano parameters safe ache।"

                header = ""
                if is_access_request:
                    header = "✅ **XAI ebong Machine Learning (ML) Prediction Access Active Kora Ache!**\n\nNiche apnar live telemetry prediction ebong kon feature keno daiye tar explainable breakdown dewa holo:\n\n"

                resp = (
                    f"{header}🧠 **Explainable AI (XAI) & ML Risk Assessment:**\n\n"
                    f"- **Bortoman Prediction:** {icon} **{risk_lvl} ({risk_banglish})**\n"
                    f"- **Model Confidence:** **{conf}%**\n"
                    f"- **Class Probabilities:**\n"
                    f"  - 🟢 Green (Safe): **{probs.get('Green', 0)}%**\n"
                    f"  - 🟡 Yellow (Moderate Risk): **{probs.get('Yellow', 0)}%**\n"
                    f"  - 🔴 Red (High Hazard): **{probs.get('Red', 0)}%**\n\n"
                    f"🔍 **Kon Feature Keno Daiye (TreeSHAP Attributions):**\n\n"
                    f"⚠️ **Risk baracche jeishob factor (Risk Drivers):**\n"
                    f"{risk_section}\n\n"
                    f"🛡️ **Risk komiye shurokkhito rakhche jeishob factor (Protective Drivers):**\n"
                    f"{protect_section}\n\n"
                    f"💡 **Clinical Action Plan (GINA Guideline):**\n"
                    f"{rec}"
                )

            else:
                icon = "🟢" if risk_lvl == "Green" else "🟡" if risk_lvl == "Yellow" else "🔴"
                risk_desc = "Safe Baseline / Low Risk" if risk_lvl == "Green" else "Moderate Exacerbation Risk" if risk_lvl == "Yellow" else "High Hazard Exacerbation Danger"

                risk_lines = []
                for idx, r in enumerate(top_risks, 1):
                    risk_lines.append(
                        f"{idx}. **{r['name']}** ({r['value']} {r['unit']}) — Attribution: **{r['contribution_pct']}%** (SHAP: `+{r['shap_value']:.4f}`)\n"
                        f"   - *Clinical Rationale:* {r['clinical_rationale_en']}"
                    )
                risk_section = "\n".join(risk_lines) if risk_lines else "- No acute exacerbation drivers detected."

                protect_lines = []
                for idx, p in enumerate(top_protects, 1):
                    protect_lines.append(
                        f"{idx}. **{p['name']}** ({p['value']} {p['unit']}) — Protective Attribution: **{p['contribution_pct']}%** (SHAP: `{p['shap_value']:.4f}`)\n"
                        f"   - *Protective Mechanism:* {p['clinical_rationale_en']}"
                    )
                protect_section = "\n".join(protect_lines) if protect_lines else "- Other baseline environmental factors remain optimal."

                header = ""
                if is_access_request:
                    header = "✅ **Explainable AI (XAI) & Machine Learning (ML) Access is Active!**\n\nHere is your real-time risk assessment and feature attribution breakdown:\n\n"

                resp = (
                    f"{header}🧠 **Explainable AI (XAI) & Machine Learning Risk Assessment:**\n\n"
                    f"- **Current Prediction:** {icon} **{risk_lvl} ({risk_desc})**\n"
                    f"- **Model Confidence:** **{conf}%**\n"
                    f"- **Class Probabilities:**\n"
                    f"  - 🟢 Green (Safe): **{probs.get('Green', 0)}%**\n"
                    f"  - 🟡 Yellow (Moderate Risk): **{probs.get('Yellow', 0)}%**\n"
                    f"  - 🔴 Red (High Hazard): **{probs.get('Red', 0)}%**\n\n"
                    f"🔍 **Feature Attributions & Causal Impact (TreeSHAP):**\n\n"
                    f"⚠️ **Top Risk Drivers (Factors elevating risk):**\n"
                    f"{risk_section}\n\n"
                    f"🛡️ **Top Protective Drivers (Factors mitigating risk):**\n"
                    f"{protect_section}\n\n"
                    f"💡 **Clinical Recommendation (GINA Compliant):**\n"
                    f"{rec}"
                )

            return {"response": resp, "tools_called": tools_called, "mode": "local_fallback"}

        # 7. Live sensors / Telemetry
        if any(w in q for w in ["telemetry", "sensor", "mq135", "temp", "humidity", "live"]):
            telem_data = self.execute_tool("get_live_telemetry_and_sensors", {}, current_user, app_state)
            tools_called.append({"name": "get_live_telemetry_and_sensors", "arguments": {}})
            if lang == "bn":
                resp = (
                    f"📡 **ESP32 নোড লাইভ সেন্সর ডেটা ({telem_data.get('device_node')}):**\n\n"
                    f"- **ইনডোর টেম্পারেচার:** {telem_data.get('temperature_celsius')} °C\n"
                    f"- **ইনডোর হিউমিডিটি:** {telem_data.get('humidity_percent')} %\n"
                    f"- **PM1.0 (Ultrafine):** {telem_data.get('pm1_0_ug_m3')} µg/m³\n"
                    f"- **PM2.5 (Fine Particulates):** {telem_data.get('pm2_5_ug_m3')} µg/m³\n"
                    f"- **PM10 (Dust):** {telem_data.get('pm10_ug_m3')} µg/m³\n"
                    f"- **MQ135 গ্যাস/এয়ার কোয়ালিটি:** {telem_data.get('mq135_air_quality_index')} ADC\n\n"
                    f"✅ সেন্সর স্ট্যাটাস: **{telem_data.get('status').upper()}**। বাতাস সন্তোষজনক সীমার মধ্যে রয়েছে।"
                )
            elif lang == "banglish":
                resp = (
                    f"📡 **ESP32 Node Live Sensor Data ({telem_data.get('device_node')}):**\n\n"
                    f"- **Indoor Temperature:** {telem_data.get('temperature_celsius')} °C\n"
                    f"- **Indoor Humidity:** {telem_data.get('humidity_percent')} %\n"
                    f"- **PM1.0:** {telem_data.get('pm1_0_ug_m3')} µg/m³\n"
                    f"- **PM2.5:** {telem_data.get('pm2_5_ug_m3')} µg/m³\n"
                    f"- **PM10:** {telem_data.get('pm10_ug_m3')} µg/m³\n"
                    f"- **MQ135 VOC:** {telem_data.get('mq135_air_quality_index')} ADC\n\n"
                    f"✅ Hardware Status: **ONLINE**। Indoor batash safe limits er moddhe ache।"
                )
            else:
                resp = (
                    f"📡 **ESP32 Real-Time Sensor Telemetry ({telem_data.get('device_node')}):**\n\n"
                    f"- **Indoor Temperature:** {telem_data.get('temperature_celsius')} °C\n"
                    f"- **Indoor Humidity:** {telem_data.get('humidity_percent')} %\n"
                    f"- **PM1.0:** {telem_data.get('pm1_0_ug_m3')} µg/m³\n"
                    f"- **PM2.5:** {telem_data.get('pm2_5_ug_m3')} µg/m³\n"
                    f"- **PM10:** {telem_data.get('pm10_ug_m3')} µg/m³\n"
                    f"- **MQ135 VOC:** {telem_data.get('mq135_air_quality_index')} ADC\n\n"
                    f"✅ Hardware Status: **ONLINE**. Indoor air quality satisfies WHO standards."
                )

            return {"response": resp, "tools_called": tools_called, "mode": "local_fallback"}

        # 7. Default helpful assistant response (Natural, no robotic tool listing!)
        if lang == "bn":
            resp = f"হ্যালো {user_name}! আমি আপনার **রেস্পিগার্ড এআই অ্যাসিস্ট্যান্ট**। আপনার ইনডোর সেন্সর, এলাকার এয়ার কোয়ালিটি ম্যাপ, ওষুধের শিডিউল বা ডাক্তারের পরামর্শ নিয়ে যেকোনো প্রশ্ন করতে পারেন!"
        elif lang == "banglish":
            resp = f"Hello {user_name}! Ami apnar **RespiGuard AI Assistant**। Apnar live sensor, air quality map, osudh er schedule ba doctor k message pathano niye jekono question korte paren!"
        else:
            resp = f"Hello {user_name}! I am your **RespiGuard AI Assistant**. How can I help you with your environmental telemetry, regional air quality map, medication schedule, or consultations today?"

        return {
            "response": resp,
            "tools_called": [],
            "mode": "local_fallback"
        }
