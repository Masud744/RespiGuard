# AuraBreath AI / RespiGuard XAI Dashboard

An Explainable AI (XAI) Asthma Exacerbation Risk Prediction System powered by **FastAPI (Python)** and **React + Tailwind CSS (Vite)**, with a visual design matching the reference image (`docs/dashboard reference.jpeg`).

---

## 🌟 Key Features

1. **Exact Visual Theme Alignment**:
   - Deep luxury emerald theme (`#060f0c`, `#0a1713`) with glowing mint/emerald accents (`#00e599`, `#10b981`).
   - Frosted glass cards, glowing active pills, and custom typography (`Plus Jakarta Sans`).
   - Hero banner with 3D medical avatar mascot and real-time status summary.

2. **Explainable AI (XAI) with TreeSHAP**:
   - Evaluates ambient environmental readings from **DHT22** (Temperature, Relative Humidity) and **PMS5003** (PM1.0, PM2.5, PM10).
   - Classifies risk into **Green (Safe)**, **Yellow (Moderate)**, or **Red (High Exacerbation Alert)**.
   - Calculates exact **Shapley Additive exPlanations (SHAP)**: Shows *why* a decision was made and which specific sensor reading pushed the score up or down.
   - Generates natural language clinical narratives and actionable doctor recommendations.

3. **Interactive Telemetry Simulator**:
   - Interactive sliders for Temperature, Humidity, PM1.0, PM2.5, and PM10.
   - Quick presets for Clean Air, High Humidity/Dust, and Severe Pollution Spikes.
   - Live updates to risk class, concentric radial air quality gauge, adherence curves, and SHAP waterfall attributions.

4. **Visual Analytics Suite (matching Reference UI)**:
   - **Today's Air Quality Radial Gauge**: Concentric circular progress rings for PM2.5, PM10, and Humidity around the central AQI index.
   - **Adherence Overview**: Smooth dual-line area spline chart with Weekly/Daily/Live timeframe filtering.
   - **Recent Professionals / Clinical Alerts**: Trigger log with doctor specialty cards and alert timestamps.
   - **XAI Feature Impact Trends**: Gradient capsule bar chart representing weekly/feature weightings.
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

## 📡 API Endpoints

- `POST /api/predict`: Takes `{ temperature, humidity, pm1_0, pm2_5, pm10 }` and returns class probabilities, prediction, base value, and localized SHAP feature attributions.
- `GET /api/global-importance`: Dataset-level mean absolute SHAP values.
- `GET /api/stats`: Telemetry frames processed, active nodes, and summary metrics.
- `GET /api/history`: Time series telemetry for charts.
- `GET /api/alerts`: Clinical trigger logs and doctor advisories.
