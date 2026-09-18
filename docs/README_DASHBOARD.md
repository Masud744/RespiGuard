# AuraBreath AI / RespiGuard XAI Dashboard

An Explainable AI (XAI) Asthma Exacerbation Risk Prediction System powered by **FastAPI (Python)** and **React + Tailwind CSS (Vite)**, with a visual design matching the reference image (`docs/dashboard reference.jpeg`).

---

## 🌟 Key Features

1. **Exact Visual Theme Alignment**:
   - Deep luxury emerald theme (`#060f0c`, `#0a1713`) with glowing mint/emerald accents (`#00e599`, `#10b981`).
   - Frosted glass cards, glowing active pills, and custom typography (`Plus Jakarta Sans`).
   - Hero banner with 3D medical avatar mascot and real-time status summary.

2. **Explainable AI (XAI) with TreeSHAP (Legacy Model Provenance)**:
   - Evaluates ambient environmental readings using the **previously trained legacy model bundle** (`two_stage_asthma_model.joblib`) or the fallback baseline model (`random_forest_asthma.joblib`).
   - **Adult-Only Demographic Scope:** Trained strictly on 22 adult asthma subjects ($N=22$); pediatric data is $N=0$. Pediatric evaluation is an unvalidated out-of-distribution evaluation requiring platform boundary gating.
   - **Status:** `ML implementation and retraining: NOT STARTED`.
   - Calculates localized **TreeSHAP** attributions to identify feature risk contributions.

3. **Interactive Telemetry Simulator**:
   - Interactive sliders for Temperature, Humidity, PM1.0, PM2.5, and PM10.
   - Quick presets for Clean Air, High Humidity/Dust, and Severe Pollution Spikes.
   - Live updates to risk class, concentric radial air quality gauge, adherence curves, and SHAP waterfall attributions.

4. **Visual Analytics Suite (matching Reference UI)**:
   - **Today's Air Quality Radial Gauge**: Concentric circular progress rings for PM2.5, PM10, and Humidity around central AQI index.
   - **Adherence Overview (Synthetic Implementation - DISC-03)**: Powered by `GET /api/history`, which computes synthetic trigonometric adherence approximations over sampled CSV data (not live patient database telemetry).
   - **Recent Professionals / Clinical Alerts (Static Mock Feed - DISC-02)**: Powered by `GET /api/alerts`, which returns a static hardcoded array of 3 mock advisory cards (zero database queries occur).
   - **XAI Feature Impact Trends**: Gradient capsule bar chart representing TreeSHAP feature weightings.
   - **Blood Pressure & Telemetry Wave**: Glowing waveform sparkline area chart.

---

## 🚀 How to Run

### Step 1: Install & Run Backend (FastAPI)
```bash
# In project root or backend folder:
pip install -r backend/requirements.txt

# Start backend:
python run_backend.py
```
*Backend runs at `http://127.0.0.1:8000` (Interactive Swagger Docs: `http://127.0.0.1:8000/docs`)*

### Step 2: Install & Run Frontend (React)
```bash
# In frontend folder:
cd frontend
npm install
npm run dev
```
*Frontend runs at `http://localhost:5173`*

Or double-click `run_backend.bat` and `run_frontend.bat` on Windows.

---

## 📡 API Endpoints & Operational Status

> **Security Notice (DISC-04):** Current dashboard endpoints do not enforce authentication or Bearer tokens (`[REMEDIATION NOT IMPLEMENTED]`). All dashboard queries currently run unauthenticated.

- `POST /api/predict`: **Existing implementation — legacy model dependency** (takes `{ temperature, humidity, pm1_0, pm2_5, pm10 }` and returns probabilities, prediction, base value, and localized SHAP feature attributions via legacy model or fallback).
- `GET /api/global-importance`: **Existing implementation — legacy model dependency** (dataset-level mean absolute SHAP values).
- `GET /api/stats`: **Existing implementation — not security-hardened** (telemetry frames processed, active nodes, and summary metrics).
- `GET /api/history`: **Synthetic adherence generator (DISC-03)** (generates sine-wave adherence approximations over raw CSV; not live patient database history).
- `GET /api/alerts`: **Static mock endpoint — no live database queries (DISC-02)** (returns hardcoded mock clinical trigger logs and doctor advisories).
