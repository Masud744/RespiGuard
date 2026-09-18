# RespiGuard Production Deployment Guide (Render & Cloud)

This guide provides end-to-end instructions for deploying the **RespiGuard** clinical IoT & respiratory analytics platform on [Render](https://render.com).

---

## 🏗️ Architecture Overview

The system consists of two cloud services and an embedded edge hardware node:
1. **Backend Web Service (`respiguard-backend`)**: Python FastAPI backend serving TreeSHAP explainability, Supabase database synchronization, Open-Meteo weather intelligence, Groq LLM clinical copilot, and AES-256 encrypted consultations.
2. **Frontend Static Site (`respiguard-frontend`)**: React + Vite + TailwindCSS clinical dashboard with Leaflet interactive air maps, live sensor dials, and medication management.
3. **Hardware Node (`ESP32`)**: Physical IoT device streaming real-time DHT22, PMS5003 laser dust, and MQ-135 sensor telemetry via WiFi HTTPS to the backend.

---

## 🚀 Option 1: Automated One-Click Deploy (Render Blueprint)

The repository includes a root `render.yaml` Blueprint specification.

1. Push your repository to GitHub (`Masud744/RespiGuard`).
2. Log in to your [Render Dashboard](https://dashboard.render.com).
3. Click **New +** → **Blueprint**.
4. Connect your GitHub repository `Masud744/RespiGuard`.
5. Render will detect `render.yaml` and configure both services automatically:
   - `respiguard-backend` (Python Web Service)
   - `respiguard-frontend` (Static Site linked to backend)
6. Populate the required environment variables in the Render prompt (see below).
7. Click **Apply**.

---

## 🛠️ Option 2: Manual Step-by-Step Deployment

### Step 1: Deploy Backend (`respiguard-backend`)

1. In Render Dashboard, click **New +** → **Web Service**.
2. Connect repository `Masud744/RespiGuard`.
3. Configure settings:
   - **Name:** `respiguard-backend`
   - **Region:** Any (e.g., Oregon or Frankfurt)
   - **Branch:** `main`
   - **Root Directory:** *(leave blank for root)*
   - **Runtime:** `Python`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `python run_backend.py`
4. Set **Environment Variables**:
   | Variable | Value / Description |
   | :--- | :--- |
   | `HOST` | `0.0.0.0` |
   | `PORT` | `10000` *(Render sets this dynamically)* |
   | `ENVIRONMENT` | `production` |
   | `SUPABASE_URL` | Your Supabase Project URL (`https://xyz.supabase.co`) |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Secret Key |
   | `SUPABASE_ANON_KEY` | Supabase Anon Public Key |
   | `GROQ_API_KEY` | Your Groq API Key (for Llama-3.3-70B Copilot) |
   | `SMTP_HOST` | `smtp.gmail.com` |
   | `SMTP_PORT` | `587` |
   | `SMTP_USER` | Your email address |
   | `SMTP_PASS` | Your Google App Password |
   | `SENDER_EMAIL` | Sender email address |
5. Click **Deploy Web Service**.
6. Once deployed, copy your backend URL (e.g., `https://respiguard-backend.onrender.com`).
   - Test health check: `https://respiguard-backend.onrender.com/health`

---

### Step 2: Deploy Frontend (`respiguard-frontend`)

1. In Render Dashboard, click **New +** → **Static Site**.
2. Connect repository `Masud744/RespiGuard`.
3. Configure settings:
   - **Name:** `respiguard-frontend`
   - **Branch:** `main`
   - **Root Directory:** `frontend`
   - **Build Command:** `npm install && npm run build`
   - **Publish Directory:** `dist`
4. Configure **Redirects / Rewrites**:
   - Add a rewrite rule for Single Page Application routing:
     - **Source:** `/*`
     - **Destination:** `/index.html`
     - **Action:** `Rewrite`
5. Set **Environment Variables**:
   | Variable | Value |
   | :--- | :--- |
   | `VITE_API_URL` | `https://respiguard-backend.onrender.com` *(Your Backend URL)* |
6. Click **Deploy Static Site**.

---

### Step 3: Configure ESP32 Hardware Firmware

Once your backend is live on Render:
1. Open `firmware/esp32_respiguard/config.h`.
2. Update `BACKEND_HOST` with your Render domain:
   ```c
   // Set to your deployed Render URL
   #define BACKEND_HOST "https://respiguard-backend.onrender.com"
   ```
3. Flash the firmware to your ESP32 board using Arduino IDE or PlatformIO.
4. Your ESP32 will immediately begin sending live sensor telemetry to the Render backend and Supabase cloud!

---

## 🔒 Security & CORS Notes
- The backend automatically permits CORS from:
  - Any `*.onrender.com` frontend domain.
  - Local development environments (`http://localhost:5173`, `http://127.0.0.1:5173`).
  - Custom domains specified in the `CORS_ORIGINS` or `FRONTEND_URL` environment variables.
- CSRF validation automatically authorizes state-changing endpoints for recognized production origins.
