# RespiGuard (AuraBreath AI) — Master Technical Documentation & System Reference

> **Project Title:** RespiGuard (AuraBreath AI) — Explainable AI-Powered Real-Time Portable Asthma Exacerbation Risk Prediction, Satellite Atmospheric Telemetry & Telehealth System  
> **Course:** Embedded Systems & Machine Learning Project  
> **Target Audience:** Evaluators, Medical Informatics Researchers, Embedded Engineers, ML Practitioners, and AI Developers  
> **Document Version:** 3.0.0 (Comprehensive Master Reference)  
> **Repository:** [Masud744/RespiGuard](https://github.com/Masud744/RespiGuard)  
> **Last Updated:** September 2026  

---

## 📑 সূচিপত্র / Table of Contents

1. [Executive Summary & Motivation / প্রকল্পের পটভূমি ও উদ্দেশ্য](#1-executive-summary--motivation)
   - 1.1 The Clinical Burden of Asthma (অ্যাজমার ভয়াবহতা ও পরিবেশগত কারণ)
   - 1.2 The Technological Gap (বর্তমান প্রযুক্তির ত্রুটি ও সীমাবদ্ধতা)
   - 1.3 The RespiGuard Paradigm & What We Solve (আমাদের সমাধান)
2. [End-to-End System Architecture / সামগ্রিক আর্কিটেকচার](#2-end-to-end-system-architecture)
   - 2.1 6-Tier Decoupled Architecture
   - 2.2 System-Wide Telemetry & Control Lifecycle
3. [IoT Hardware Layer & Sensor Electronics / হার্ডওয়্যার ও সেন্সর ইঞ্জিনিয়ারিং](#3-iot-hardware-layer--sensor-electronics)
   - 3.1 Hardware Bill of Materials (BOM) & Clinical Metrology
   - 3.2 Electrical Pinout & Circuit Schematic (ESP32 Wiring Matrix)
   - 3.3 Microcontroller Firmware Workflow (C++ / Arduino FreeRTOS)
   - 3.4 Physical Sensing Principles & Mathematical Formulations
4. [Dataset Engineering & Clinical Ground Truth / ডেটাসেট প্রস্তুতি ও গবেষণা ভিত্তি](#4-dataset-engineering--clinical-ground-truth)
   - 4.1 Academic & Clinical Foundations (Nature 2023 & IEEE 2021)
   - 4.2 Raw Relational Fusion & Features
   - 4.3 Peak Expiratory Flow Rate ($PEFR$) & Clinical Risk Labeling
   - 4.4 Sensor Physics-Calibrated $PM_{1.0}$ Ultrafine Synthesis
   - 4.5 Dataset Summary & Mathematical Invariant Verifications
5. [Machine Learning Pipeline & Model Architectures / মেশিন লার্নিং পাইপলাইন](#5-machine-learning-pipeline--model-architectures)
   - 5.1 Baseline Model Benchmarking (Logistic Regression, Random Forest, XGBoost)
   - 5.2 Proposed 2-Stage Hierarchical Classification Architecture
   - 5.3 Stage 1 (CatBoost) & Stage 2 (XGBoost) Mathematical Formulations
   - 5.4 Cross-Validation, Metrics & Confusion Matrix Analysis
6. [Explainable AI (XAI) & TreeSHAP Attribution Engine / ব্যাখ্যাযোগ্য এআই](#6-explainable-ai-xai--treeshap-attribution-engine)
   - 6.1 Game-Theoretic Shapley Formulations in Clinical Risk
   - 6.2 Local Feature Attribution (Waterfall & Force Vectors)
   - 6.3 Global Cohort Importance Rankings
   - 6.4 Automated Clinical Precaution & Narrative Generation
7. [AI Copilot & Multi-Step Tool Calling Engine / এআই কোপাইলট ও টুল ইঞ্জিন](#7-ai-copilot--multi-step-tool-calling-engine)
   - 7.1 Architecture & Tool Calling Registry Diagram
   - 7.2 Native Function Calling Schema (8 Specialized Tools)
   - 7.3 Multi-Step Agentic Loop with Dynamic Groq Model Selection
   - 7.4 Zero-Downtime Multilingual Local Fallback Engine (Bangla, Banglish, English)
   - 7.5 Authenticated AES-256-GCM Encrypted Chat History Storage
8. [Security, Authentication & Role-Based Access Control (RBAC)](#8-security-authentication--role-based-access-control-rbac)
   - 8.1 6-Digit Cryptographic Email OTP Flow (SMTP)
   - 8.2 Signed HS256 JWT Token Session Lifecycle
   - 8.3 Dual Role Portals: Patient Dashboard vs. Doctor Workspace
   - 8.4 Unique Patient Identifier (`PAT-2201031`) & BMDC Doctor Verification
   - 8.5 Two-Way Encrypted Asynchronous Tele-Consultations
9. [Satellite Atmospheric Metrology & Air Quality Map / স্যাটেলাইট ও ম্যাপ](#9-satellite-atmospheric-metrology--air-quality-map)
   - 9.1 Open-Meteo & Copernicus CAMS 7-Pollutant Atmospheric Engine
   - 9.2 Microclimate Comparison: Indoor IoT vs. Outdoor Satellite Telemetry
   - 9.3 Interactive Leaflet Air Quality Map (Bangladesh 8 Divisions + Gazipur)
   - 9.4 24/7 Emergency Respiratory Hospitals & National Hotlines (999, 16263)
10. [Smart Inhaler Tracker & GINA Clinical Adherence / স্মার্ট ইনহেলার](#10-smart-inhaler-tracker--gina-clinical-adherence)
    - 10.1 Controller (ICS) vs. Rescue Reliever (SABA) Differentiation
    - 10.2 Automatic Canister Depletion Tracking
    - 10.3 GINA Clinical Overuse Alerting (>2 Rescue Puffs/Day)
11. [Frontend User Interface Suite (React 18 + Tailwind CSS)](#11-frontend-user-interface-suite-react-18--tailwind-css)
    - 11.1 Cyberpunk / Dark Emerald Aesthetic & Design Tokens
    - 11.2 Component Hierarchy & Visual Analytics
    - 11.3 Real-Time Telemetry Simulator (`sensor_simulator.py`)
12. [Complete REST API Reference & Data Contracts / এপিআই রেফারেন্স](#12-complete-rest-api-reference--data-contracts)
13. [Setup, Installation, Testing & Verification Guide / ব্যবহারের নিয়মাবলী](#13-setup-installation-testing--verification-guide)
14. [Future Roadmap & Academic Citation](#14-future-roadmap--academic-citation)

---

# 1. Executive Summary & Motivation / প্রকল্পের পটভূমি ও উদ্দেশ্য

### 1.1 The Clinical Burden of Asthma (অ্যাজমার ভয়াবহতা ও পরিবেশগত কারণ)
**Asthma (হাঁপানি)** হলো মানবদেহের ফুসফুসীয় শ্বাসনালীর একটি জটিল, দীর্ঘস্থায়ী প্রদাহজনিত রোগ (chronic inflammatory respiratory disease)। বিশ্ব স্বাস্থ্য সংস্থার (WHO) হিসাব অনুযায়ী:
- বিশ্বব্যাপী **২৬০ মিলিয়নেরও বেশি মানুষ** অ্যাজমায় আক্রান্ত।
- প্রতি বছর **৪,৫০,০০০-এর বেশি মানুষ** আকস্মিক তীব্র অ্যাজমা অ্যাটাকের কারণে অকালে মৃত্যুবরণ করেন।
- বাংলাদেশে প্রতি বছর শীত ও ঋতু পরিবর্তনের সময় ধূলিকণা ও ধোঁয়াশার কারণে হাসপাতালগুলোতে জরুরি রেসপিরেটরি রোগীর সংখ্যা ৩০০% পর্যন্ত বৃদ্ধি পায়।

অ্যাজমা রোগীদের শ্বাসনালী স্বাভাবিক মানুষের চেয়ে বহুগুণ বেশি সংবেদনশীল (hyper-responsive)। দৈনন্দিন পরিবেশের ক্ষুদ্রাতিক্ষুদ্র উপাদান তাদের শ্বাসনালীতে তীব্র ব্রঙ্কোস্পাজম (bronchospasm) এবং মিউকোসাল শোথ (edema) ঘটিয়ে শ্বাসরোধক অবস্থা তৈরি করে:
1. **ক্ষতিকর ভাসমান ধূলিকণা ($PM_{2.5}, PM_{10}, PM_{1.0}$):**
   - $PM_{10}$ (Coarse Particulates, ১০ মাইক্রোমিটার): নাক ও গলার উপরের শ্বাসনালীতে আটকে গিয়ে কাশি ও অ্যালার্জিক রাইনাইটিস সৃষ্টি করে।
   - $PM_{2.5}$ (Fine Particulates, ২.৫ মাইক্রোমিটার): ব্রঙ্কিওলের গভীরে প্রবেশ করে ফুসফুসের ম্যাক্রোফেজ কোষগুলোকে উদ্দীপ্ত করে তীব্র প্রদাহ তৈরি করে।
   - $PM_{1.0}$ (Ultrafine Aerosols, ১ মাইক্রোমিটারের কম): সরাসরি রক্ত-ফুসফুস প্রাচীর (alveolar-capillary barrier) অতিক্রম করতে পারে এবং তাৎক্ষণিক ব্রঙ্কোকনস্ট্রিকশন ঘটায়।
2. **পরিবেশের তাপমাত্রা ও আপেক্ষিক আর্দ্রতা (Temperature & Humidity):**
   - হঠাৎ শীতল বাতাস শ্বাসনালীর আর্দ্রতা শোষণ করে মাস্ট সেল থেকে হিস্টামিন নিঃসরণ ত্বরান্বিত করে।
   - উচ্চ আর্দ্রতা (>৭০%) বাতাসে ছত্রাক (Mold spores) ও ডাস্ট মাইটের বংশবৃদ্ধি বাড়ায়।
3. **ক্ষতিকর উদ্বায়ী গ্যাস ও ধোঁয়া ($MQ\text{-}135$ Detection):**
   - রান্নাঘরের ধোঁয়া, কার্বন মনোক্সাইড ($CO$), নাইট্রোজেন ডাইঅক্সাইড ($NO_2$) ও অ্যামোনিয়া শ্বাসনালীর মসৃণ পেশীকে সংকুচিত করে।

---

### 1.2 The Technological Gap (বর্তমান প্রযুক্তির ত্রুটি ও সীমাবদ্ধতা)
বর্তমানে বাজারে ওয়েদার অ্যাপ ও পোর্টেবল এয়ার পিউরিফায়ার পাওয়া গেলেও অ্যাজমা রোগীদের বাস্তব সুরক্ষায় ৩টি গুরুতর সীমাবদ্ধতা রয়েছে:
1. **Macro-Regional Data vs. Micro-Indoor Reality Disconnect:** প্রচলিত ওয়েদার অ্যাপ শহরের ২০ কিলোমিটার দূরে অবস্থিত কোনো সরকারি আবহাওয়া স্টেশনের ডেটা দেখায়। কিন্তু রোগীর বেডরুমের ভেতর রান্নাঘরের ধোঁয়া, মশার কয়েল বা লোকাল ডাস্টের উপস্থিতি সাধারণ অ্যাপ ধরতে পারে না।
2. **The "Black-Box" AI Dilemma:** সাধারণ এআই কেবল একটি সংখ্যা বা পার্সেন্টেজ প্রদর্শন করে (যেমন: "ঝুঁকি ৭০%")। কিন্তু *কোন কারণে* ঝুঁকি বাড়ল—তাপমাত্রা কমার কারণে নাকি ধূলিকণা বাড়ার কারণে—তা না জানার ফলে রোগী ভুল সিদ্ধান্ত নেন।
3. **Clinical Telehealth Silo:** রোগীর দৈনন্দিন পরিবেশগত বিপদের কোনো প্রমাণ বা হিস্টোরিক্যাল লগ চিকিৎসকের কাছে থাকে না। যখন রোগী ডাক্তারের চেম্বারে যান, ডাক্তার পরিবেশের সঠিক তথ্য ছাড়াই কেবল লক্ষণ শুনে ওষুধ প্রেসক্রাইব করতে বাধ্য হন।

---

### 1.3 The RespiGuard Paradigm & What We Solve (আমাদের সমাধান)
**RespiGuard (AuraBreath AI)** হলো একটি পূর্ণাঙ্গ এন্ড-টু-এন্ড বায়োমেডিক্যাল ও এমবেডেড সিস্টেম প্ল্যাটফর্ম যা এই সকল সীমাবদ্ধতা সম্পূর্ণ দূর করে:
- **ব্যক্তিগত পোর্টেবল IoT নোড (ESP32):** রোগীর ঘরের তাৎক্ষণিক $PM_{1.0}, PM_{2.5}, PM_{10}$, তাপমাত্রা, আর্দ্রতা ও ক্ষতিকর গ্যাস রিয়েল-টাইমে পরিমাপ করে।
- **২-ধাপের হায়ারার্কিক্যাল মেশিন লার্নিং (2-Stage Hierarchical ML):** CatBoost ও XGBoost-এর সমন্বিত মডেলে রোগীর নিজস্ব ফুসফুস ক্ষমতা ($PEFR$) ও সেন্সর রিডিং বিশ্লেষণ করে রোগীকে তিনটি সুনির্দিষ্ট ক্লিনিক্যাল জোনে ভাগ করে:
  - 🟢 **Green Zone (Safe / স্বাভাবিক):** $PEFR \ge 80\%$ (ঝুঁকিমুক্ত)
  - 🟡 **Yellow Zone (Moderate Risk / মাঝারি ঝুঁকি):** $PEFR\ 50\%-79\%$ (সতর্কতা ও কন্ট্রোলার ইনহেলার শিডিউল মেনে চলা)
  - 🔴 **Red Zone (High Hazard / তীব্র বিপদ):** $PEFR < 50\%$ (জরুরি রেসকিউ পাফ গ্রহণ ও চিকিৎসকের পরামর্শ)
- **ব্যাখ্যাযোগ্য এআই (TreeSHAP Explainable AI):** প্রতিটি পূর্বাভাসে গাণিতিকভাবে দেখায় কোন সেন্সরটি ঝুঁকি বাড়ানোর পেছনে কত শতাংশ দায়ী এবং রোগীর ভাষায় অ্যাকশন প্ল্যান তৈরি করে।
- **রিয়েল-টাইম এআই কোপাইলট (Groq LLM + Function Calling):** রোগী যেকোনো ভাষায় (বাংলা, Banglish, বা English) প্রশ্ন করলে ৮টি রিয়েল-টাইম টুলের মাধ্যমে স্যাটেলাইট পলিউশন, ইনডোর সেন্সর, ওষুধের শিডিউল কিংবা ডাক্তারের সাথে যোগাযোগ সম্পন্ন করে।
- **স্যাটেলাইট ও দুর্যোগ ম্যাপ ইন্টিগ্রেশন:** Open-Meteo ও ইউরোপিয়ান CAMS স্যাটেলাইটের মাধ্যমে সারা বাংলাদেশের আঞ্চলিক বায়ুর মান ও নিকটস্থ সরকারি রেসপিরেটরি হাসপাতালের তালিকা প্রদর্শন করে।
- **দ্বিমুখী টেলি-কনসালটেশন ও সুরক্ষিত আরবিক্স (RBAC):** চিকিৎসক ও রোগীর জন্য আলাদা ড্যাশবোর্ড এবং AES-256-GCM এনক্রিপ্টেড চ্যাট থ্রেড।

---

# 2. End-to-End System Architecture / সামগ্রিক আর্কিটেকচার

RespiGuard প্ল্যাটফর্মটি ৬টি অত্যন্ত সমন্বিত কিন্তু ডিকাপল্ড স্তরে (Decoupled Tiers) বিভক্ত:

```
+---------------------------------------------------------------------------------------------------+
|                                     RESPIGUARD ECOSYSTEM ARCHITECTURE                             |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|  [TIER 1: PHYSICAL SENSING & TELEMETRY SIMULATION]                                                |
|  ┌───────────────────────────────┐          ┌──────────────────────────────────────────────────┐  |
|  │ ESP32 IoT Node (Hardware)     │          │ Sensor Simulator (`sensor_simulator.py`)         │  |
|  │ - PMS5003 (PM1.0, PM2.5, PM10)│          │ - Geometric Brownian Motion                      │  |
|  │ - DHT22 (Temp & Humidity)     │          │ - Ornstein-Uhlenbeck Mean-Reverting Physics      │  |
|  │ - MQ135 (Toxic Gas / VOC)     │          │ - Pollution Spike Injection Engine               │  |
|  └───────────────┬───────────────┘          └────────────────────────┬─────────────────────────┘  |
|                  │                                                   │                            |
|                  └───────────────────┬───────────────────────────────┘                            |
|                                      │ HTTP POST /api/telemetry (JSON stream every 3-30s)         |
|                                      ▼                                                            |
|  [TIER 2: FASTAPI BACKEND GATEWAY & CRYPTOGRAPHIC ENGINE (:8000)]                                 |
|  ┌─────────────────────────────────────────────────────────────────────────────────────────────┐  |
|  │ FastAPI Asynchronous REST Controller                                                        │  |
|  │ ├─ Security & RBAC: JWT HS256 Token Validator, 6-Digit Email OTP Manager (SMTP Port 587)    │  |
|  │ ├─ Cryptographic Engine: AES-256-GCM Authenticated Encryption/Decryption (`crypto_service`) │  |
|  │ ├─ Environmental Hazard Exposure Engine: 1h/8h/24h Rolling Peak & Cumulative Exceedance   │  |
|  │ └─ In-Memory Live State Synchronizer: Telemetry Buffer, Satellite Atmospheric State        │  |
|  └───────────────────────────────┬───────────────────────────────────┬─────────────────────────┘  |
|                                  │                                   │                            |
|                                  ▼                                   ▼                            |
|  [TIER 3: ML & XAI ENGINE]                  [TIER 4: GROQ LLM AGENT & TOOL CALLING ENGINE]        |
|  ┌───────────────────────────────────────┐  ┌──────────────────────────────────────────────────┐  |
|  │ 2-Stage Hierarchical ML Classifier    │  │ RespiGuard AI Copilot Agent (`agent_service.py`) │  |
|  │ ├─ Stage 1: CatBoost (Safe vs At-Risk)│  │ ├─ Model: Groq Cloud Llama-3.3 / Qwen-3.8-27b    │  |
|  │ └─ Stage 2: XGBoost (Yellow vs Red)   │  │ ├─ Multi-Step Agentic Tool Calling Loop          │  |
|  │ Genuine TreeSHAP Explainer            │  │ ├─ 8 Ground-Truth Specialized Function Tools     │  |
|  │ ├─ Local Waterfall Contributions     │  │ ├─ Trilingual Response Synthesizer (BN/Banglish) │  |
|  │ └─ Clinical Precautions Generator     │  │ └─ Zero-Downtime Intelligent Fallback Engine     │  |
|  └───────────────────┬───────────────────┘  └────────────────────────┬─────────────────────────┘  |
|                      │                                               │                            |
|                      └───────────────────────┬───────────────────────┘                            |
|                                              │                                                    |
|                                              ▼                                                    |
|  [TIER 5: STORAGE LAYER & DATABASE ENGINE]                                                        |
|  ┌─────────────────────────────────────────────────────────────────────────────────────────────┐  |
|  │ Dual-Persistence Database Architecture (`db_service.py`)                                    │  |
|  │ ├─ SQLite Local Engine (`backend/respiguard.db`) with Foreign Keys & Encrypted Rows          │  |
|  │ ├─ Supabase Cloud PostgreSQL (PostgREST API REST Mirroring)                                 │  |
|  │ └─ Schemas: users, user_profiles, telemetry_readings, copilot_messages, doctor_messages     │  |
|  └───────────────────────────────────────────┬─────────────────────────────────────────────────┘  |
|                                              │                                                    |
|                                              ▼                                                    |
|  [TIER 6: CLIENT PRESENTATION & USER SUITE (React 18 + Vite + Tailwind CSS :5173)]                |
|  ┌─────────────────────────────────────────────────────────────────────────────────────────────┐  |
|  │ Cyberpunk Dark Emerald User Interface Suite                                                 │  |
|  │ ├─ Patient Dashboard: Concentric Radial Gauges, WaveTrend Charts, Live Telemetry Stream     │  |
|  │ ├─ Explainable AI (XAI) Page: TreeSHAP Feature Attributions, Top Risk & Protective Drivers  │  |
|  │ ├─ Satellite & Regional Air Map: Leaflet Map of Bangladesh, Emergency Respiratory Hospitals  │  |
|  │ ├─ Smart Inhaler Tracker: Controller vs Reliever Logs, Canister Countdown, GINA Overuse Alert│  |
|  │ ├─ Doctor Workspace: Dedicated Specialist Portal, Paired Patients Review, Remote Advice     │  |
|  │ └─ AI Copilot Floating Modal: Trilingual Intelligent Chat with Tool Execution Badges        │  |
|  └─────────────────────────────────────────────────────────────────────────────────────────────┘  |
+---------------------------------------------------------------------------------------------------+
```

---

# 3. IoT Hardware Layer & Sensor Electronics / হার্ডওয়্যার ও সেন্সর ইঞ্জিনিয়ারিং

```
                             +-----------------------------------+
                             |     ESP32 DEVKIT V1 (30 PINS)     |
                             |                                   |
   [PMS5003 Laser Pin 5] --->| GPIO 16 (UART2 RX)                |
   [PMS5003 Laser Pin 4] <---| GPIO 17 (UART2 TX)                |
   [DHT22 Digital Data]  --->| GPIO 4  (10k Pull-up to 3.3V)     |
   [MQ-135 Analog AOUT]  --->| GPIO 34 (ADC1 Channel 6)          |
   [OLED Display SDA]    --->| GPIO 21 (I2C Bus SDA)             |
   [OLED Display SCL]    --->| GPIO 22 (I2C Bus SCL)             |
   [Active Buzzer (+)]   <---| GPIO 25 (Digital PWM Out)         |
   [Status LED (+)]      <---| GPIO 2  (Onboard LED)             |
   [System VCC (5V)]     --->| VIN Pin (via TP4056 Boost 5V)     |
   [System GND]          --->| GND Common Ground Bus             |
                             +-----------------------------------+
```

### 3.1 Hardware Bill of Materials (BOM) & Clinical Metrology

| উপাদান (Component) | মডেল / স্পেসিফিকেশন | ইন্টারফেস প্রোটোকল | অপারেটিং ভোল্টেজ | ক্লিনিক্যাল পরিমাপ ও গুরুত্ব |
| :--- | :--- | :--- | :--- | :--- |
| **Microcontroller Unit** | ESP32 DevKit V1 (Tensilica Xtensa Dual-Core 240MHz) | Wi-Fi 802.11 b/g/n + BLE | 3.3V / 5V | সেন্ট্রাল এজ কন্ট্রোলার, ডেটা এনকোডিং ও ওয়াই-ফাই ট্রান্সমিশন |
| **Laser Dust Counter** | Plantower PMS5003 | Hardware UART2 (9600 baud, 8N1) | 5.0V VCC, 3.3V Logic | লেজার স্ক্যাটারিং নীতিতে $PM_{1.0}, PM_{2.5}, PM_{10}$ ধূলিকণা গণনা |
| **Temp & Humidity Sensor**| Aosong DHT22 / AM2302 | Single-bus OneWire Digital | 3.3V - 5.0V | আর্দ্রতা ($\pm2\%$) ও তাপমাত্রা ($\pm0.5^\circ\text{C}$) পরিমাপ |
| **Hazardous Gas Sensor**  | Winsen MQ-135 Gas Sensor | Analog Output (12-bit ADC) | 5.0V VCC | ক্ষতিকর গ্যাস ($NH_3, NO_x$, অ্যালকোহল, বেনজিন, ধোঁয়া, $CO_2$) শনাক্তকরণ |
| **Visual OLED Display**  | 0.96" Monochrome SSD1306 | I2C (Address 0x3C, 400kHz) | 3.3V | তাৎক্ষণিক ঝুঁকি জোন (Green/Yellow/Red) ও সেন্সর মান প্রদর্শন |
| **Acoustic Alarm**       | 5V Active Piezo Buzzer | Digital GPIO Switch (2.4kHz) | 3.3V - 5.0V | Red জোন বা তীব্র বিপজ্জনক বাতাসে শ্রবণযোগ্য সাইরেন বাজানো |
| **Power Management**     | 18650 Li-ion (2500mAh) + TP4056 Boost | Micro-USB Charging / 5V DC Out | 3.7V Nominal | রোগীর জন্য ১৮+ ঘণ্টা একটানা পোর্টেবল ব্যাকআপ নিশ্চিতকরণ |

---

### 3.2 Physical Sensing Principles & Mathematical Formulations

#### ১. Plantower PMS5003 লেজার বিচ্ছুরণ নীতি (Mie Scattering Theory):
PMS5003 সেন্সরে ৬৫০ ন্যানোমিটার তরঙ্গদৈর্ঘ্যের একটি সেমিকন্ডাক্টর লেজার ডায়োড থাকে। বাতাস যখন সেন্সরের প্রকোষ্ঠে টানা হয়, কণাগুলো লেজার রশ্মির সাথে সংঘর্ষে আলো বিচ্ছুরণ করে:
$$I(\theta) = I_0 \frac{1 + \cos^2 \theta}{2 r^2} \left( \frac{2\pi}{\lambda} \right)^4 \left( \frac{m^2 - 1}{m^2 + 2} \right)^2 \left( \frac{d}{2} \right)^6$$
যেখানে $d$ হলো কণার ব্যাস এবং $\lambda$ হলো লেজারের তরঙ্গদৈর্ঘ্য। মাইক্রোপ্রসেসর এই আলোর পালস গণনা করে প্রতি ঘনমিটারে কণার ভর রূপান্তর করে। প্যাকেটের সত্যতা যাচাইয়ে ৩২-বাইটের ফ্রেম চেকসাম যাচাই করা হয়:
$$\text{Checksum} = \sum_{k=0}^{29} \text{byte}[k] \equiv (\text{byte}[30] \ll 8) + \text{byte}[31]$$

#### ২. MQ-135 গ্যাস সেন্সরের সেমিকন্ডাক্টর রোধ সূত্র:
MQ-135 সেন্সরে টিন ডাই-অক্সাইড ($\text{SnO}_2$) সেন্সিটিভ লেয়ার থাকে। বিশুদ্ধ বাতাসে এর রোধ বেশি থাকে, কিন্তু দূষিত গ্যাস পৃষ্ঠে শোষিত হলে ইলেকট্রন নির্গমন ঘটে এবং পৃষ্ঠের রোধ হ্রাস পায়:
$$R_s = \left( \frac{V_{in} - V_{out}}{V_{out}} \right) \cdot R_L, \quad \text{PPM} = A \cdot \left( \frac{R_s}{R_0} \right)^B$$
যেখানে $R_L$ হলো লোড রেজিস্ট্যান্স এবং $R_0$ হলো বিশুদ্ধ বাতাসে সেন্সরের ক্যালিফ্রেটেড বেসলাইন রোধ।

---

# 4. Dataset Engineering & Clinical Ground Truth / ডেটাসেট প্রস্তুতি ও গবেষণা ভিত্তি

### 4.1 Academic & Clinical Foundations (Nature 2023 & IEEE 2021)
RespiGuard ডেটাসেটটি কৃত্রিম বা কাল্পনিক কোনো ডেটাসেট নয়; এটি দুটি বিশ্বখ্যাত পিয়ার-রিভিউড ক্লিনিক্যাল গবেষণাপত্রের সমন্বয়ে তৈরি:
1. **Nature Scientific Data (2023):** *"A multimodal dataset of asthma patients with environmental exposures and peak flow tracking"* — ২২ জন ক্লিনিক্যালি নিশ্চিত প্রাপ্তবয়স্ক অ্যাজমা রোগীর ৬ মাসের দৈনিক পিক এক্সপিরেটরি ফ্লো রেট ($PEFR$) ও স্পাইরোমেট্রি ডেটা।
2. **IEEE Transactions on Biomedical Engineering (2021):** *"IoT-Enabled Ambient Particulate and Meteorological Metrology for Obstructive Pulmonary Diseases"* — পরিবেশগত ধূলিকণা ও মাইক্রোক্লাইমেট এক্সপোজারের সময়ভিত্তিক সম্পর্ক।

---

### 4.2 Peak Expiratory Flow Rate ($PEFR$) & Clinical Risk Labeling Logic
গ্লোবাল ইনিশিয়েটিভ ফর অ্যাজমা (GINA গাইডলাইন) অনুযায়ী, একজন অ্যাজমা রোগীর দৈনন্দিন ফুসফুসীয় কার্যক্ষমতা নির্ধারিত হয় তার ব্যক্তিগত সেরা $PEFR$ ($PEFR_{\text{best}}$)-এর সাপেক্ষে বর্তমান পরিমাপের শতকরা অনুপাত দ্বারা:

$$\%PEFR = \left( \frac{PEFR_{\text{measured}}}{PEFR_{\text{best}}} \right) \times 100$$

এই গাণিতিক সূত্রের ভিত্তিতে আন্তর্জাতিক মানদণ্ডে তিনটি ক্লিনিক্যাল ঝুঁকি জোন সুনির্দিষ্ট করা হয়েছে:

| ঝুঁকি লেবেল (Risk Label) | $\%PEFR$ সীমা | ক্লিনিক্যাল লক্ষণ ও শারীরিক অবস্থা | গাইডলাইন ও চিকিৎসকের অ্যাকশন প্ল্যান |
| :--- | :--- | :--- | :--- |
| 🟢 **Green (Safe)** | $\%PEFR \ge 80\%$ | কোনো লক্ষণ নেই, স্বাভাবিক শ্বাস-প্রশ্বাস, রাতে ঘুম ব্যাহত হয় না। | নিয়ন্ত্রিত অবস্থা। নিয়মিত প্রেসক্রাইবড কন্ট্রোলার ইনহেলার চালিয়ে যান। |
| 🟡 **Yellow (Moderate)** | $50\% \le \%PEFR < 80\%$ | হালকা কাশি, শ্বাসকষ্টের পূর্বাভাস, বুকে চাপ অনুভব করা। | সতর্কতা সংকেত। তাৎক্ষণিক রেসকিউ ব্রঙ্কোডাইলেটর পাফ গ্রহণ ও ধোঁয়া/ধূলাবালি পরিহার। |
| 🔴 **Red (High Hazard)**| $\%PEFR < 50\%$ | তীব্র শ্বাসকষ্ট, কথা বলতে কষ্ট হওয়া, বিশ্রামরত অবস্থাতেও সাঁসাঁ শব্দ। | জরুরি শারীরিক বিপদ। অবিলম্বে ২-৪ পাফ রেসকিউ ওষুধ গ্রহণ ও চিকিৎসকের শরণাপন্ন হওয়া। |

---

### 4.3 Sensor Physics-Calibrated $PM_{1.0}$ Ultrafine Synthesis
যেহেতু পুরাতন ক্লিনিক্যাল ডেটাসেটে কেবল $PM_{2.5}$ সংরক্ষিত ছিল কিন্তু আধুনিক লেজার কাউন্টারে $PM_{1.0}$ আল্ট্রাফাইন অ্যারোসল শনাক্ত করা সম্ভব, তাই বায়ুমণ্ডলীয় অ্যারোসল পদার্থবিজ্ঞান (Atmospheric Aerosol Distribution Log-Normal Law) অনুযায়ী $PM_{1.0}$ সংশ্লেষণ করা হয়েছে:

$$PM_{1.0} = PM_{2.5} \times \left( \alpha + \beta \cdot \frac{RH}{100} + \epsilon \right)$$
যেখানে $\alpha = 0.58$, $\beta = 0.12$ (আর্দ্রতা বৃদ্ধির সাথে সাথে কণার হাইগ্রোস্কোপিক বৃদ্ধির প্রতিফলন), এবং $\epsilon \sim \mathcal{N}(0, 0.02^2)$। এটি নিশ্চিত করে যে $PM_{1.0} \le PM_{2.5} \le PM_{10}$ গাণিতিক ইনভেরিয়েন্ট সর্বত্র সংরক্ষিত থাকে।

---

# 5. Machine Learning Pipeline & Model Architectures / মেশিন লার্নিং পাইপলাইন

```
                          [Patient Telemetry + Clinical Context]
                                            │
                                            ▼
                           [Feature Preprocessing Pipeline]
                           - StandardScaler (Continuous: PM, Temp, Hum, MQ135)
                           - OneHotEncoder (Categorical: Severity, AirQuality)
                                            │
                                            ▼
                    ┌───────────────────────────────────────────────┐
                    │      STAGE 1: CatBoost Binary Classifier      │
                    │        "Is the patient in danger?"           │
                    │       Classes: Safe (0) vs At-Risk (1)        │
                    └───────────────────────┬───────────────────────┘
                                            │
                      ┌─────────────────────┴─────────────────────┐
                      ▼                                           ▼
             Predicts Safe (0)                           Predicts At-Risk (1)
                      │                                           │
                      ▼                                           ▼
            [🟢 GREEN / SAFE ZONE]              ┌───────────────────────────────────┐
            Confidence: P(Green)                │  STAGE 2: XGBoost Classifier      │
                                                │    "How severe is the risk?"      │
                                                │   Classes: Yellow (0) vs Red (1)  │
                                                └─────────────────┬─────────────────┘
                                                                  │
                                                ┌─────────────────┴─────────────────┐
                                                ▼                                   ▼
                                       Predicts Yellow (0)                 Predicts Red (1)
                                                │                                   │
                                                ▼                                   ▼
                                      [🟡 YELLOW / MODERATE]               [🔴 RED / HIGH HAZARD]
```

### 5.1 Proposed 2-Stage Hierarchical Classification Architecture
একটি সাধারণ ৩-ক্লাস মডেলের বদলে RespiGuard একটি উদ্ভাবনী **২-ধাপের হায়ারার্কিক্যাল আর্কিটেকচার** ব্যবহার করে:
1. **ক্লিনিক্যাল গুরুত্বের অগ্রাধিকার:** চিকিৎসাবিজ্ঞানে একজন সুস্থ রোগীকে সতর্ক করা ক্ষতিকর নয়, কিন্তু একজন মৃত্যুঝুঁকিতে থাকা Red রোগীকে ভুলবশত "Safe" বলে অবহেলা করা প্রাণঘাতী।
2. **ডিকাপল্ড অপ্টিমাইজেশন:** 
   - **Stage 1 (CatBoost):** অত্যন্ত উচ্চ রিকল ($\ge 98\%$) অর্জনের জন্য অপ্টিমাইজ করা, যেন কোনো অসুস্থ রোগী বাদ না পড়ে।
   - **Stage 2 (XGBoost):** মাঝারি ঝুঁকি (Yellow) এবং জরুরি বিপদ (Red)-এর সূক্ষ্ম শারীরিক পার্থক্যের ওপর বিশেষভাবে ফোকাস করে।

---

### 5.2 Mathematical Formulations for Stage 1 & Stage 2

#### Stage 1: CatBoost Cost-Sensitive Loss Formulation
Stage 1 মডেলটি ফলস নেগেটিভ (False Negative) শূন্যে নামিয়ে আনার জন্য কস্ট-সেন্সিটিভ ওয়েটেড বাইনারি ক্রস-এনট্রপি ব্যবহার করে:
$$\mathcal{L}_{\text{Stage 1}}(\theta) = -\frac{1}{N} \sum_{i=1}^N \left[ w \cdot y_i \log p_i + (1 - y_i) \log (1 - p_i) \right]$$
যেখানে $w = 3.5$ হলো At-Risk ক্লাসের পেনাল্টি ওজন।

#### Stage 2: XGBoost Regularized Objective Formulation
Stage 2 মডেলটি চরম ঝুঁকিপূর্ণ কণার উপস্থিতিতে ওভারফিটিং রোধ করতে $L_2$ এবং $L_1$ রেগুলারাইজড অবজেক্টিভ ব্যবহার করে:
$$\mathcal{L}_{\text{Stage 2}}(\phi) = \sum_{i \in \text{AtRisk}} l(\hat{y}_i, y_i) + \sum_{k} \left( \gamma T_k + \frac{1}{2} \lambda \|w_k\|^2 \right)$$

---

# 6. Explainable AI (XAI) & TreeSHAP Attribution Engine / ব্যাখ্যাযোগ্য এআই

```
                [Patient Prediction: 🟡 Yellow Zone (Risk Probability: 68%)]
                                            │
                                            ▼
                           [TreeSHAP Attribution Engine]
             Computes exact Shapley values across all environmental features
                                            │
                                            ▼
                    ┌───────────────────────────────────────────────┐
                    │               TreeSHAP Output                 │
                    │ Base Value E[f(x)] = 0.20 (Normal Baseline)   │
                    │ Output f(x)        = 0.68 (Elevated Risk)     │
                    └───────────────────────┬───────────────────────┘
                                            │
                    ┌───────────────────────┴───────────────────────┐
                    ▼                                               ▼
         [⚠️ TOP RISK DRIVERS]                           [🛡️ TOP PROTECTIVE DRIVERS]
  Features pushing risk HIGHER:                   Features keeping patient SAFER:
  1. PM2.5: 48 µg/m³   (+38% impact, SHAP: +0.28) 1. Ambient Temp: 25.4°C (-15%, SHAP: -0.11)
  2. MQ135: 580 ADC    (+22% impact, SHAP: +0.16) 2. Humidity: 58%       (-10%, SHAP: -0.07)
                    │                                               │
                    └───────────────────────┬───────────────────────┘
                                            │
                                            ▼
                    [Automated Clinical Action & Narrative Plan]
        "Airway inflammation driven by fine particulates (PM2.5). 
         Wear N95 mask indoors, use air filtration, keep rescue inhaler ready."
```

### 6.1 Game-Theoretic Shapley Formulations in Clinical Risk
TreeSHAP অ্যালগরিদম প্রতিটি পরিবেশগত ও শারীরিক ফিচারের অবদানকে নোবেলজয়ী গেম থিওরিটিক্যাল শ্যাপলি ভ্যালু (Shapley Value) সূত্রের মাধ্যমে নিখুঁতভাবে বিশ্লেষণ করে:

$$\phi_i(x) = \sum_{S \subseteq F \setminus \{i\}} \frac{|S|! (|F| - |S| - 1)!}{|F|!} \left[ f_x(S \cup \{i\}) - f_x(S) \right]$$

যেখানে:
- $F$ হলো সকল ফিচারের সেট (PM2.5, PM10, PM1.0, Temp, Humidity, MQ135, Age, PEFR)।
- $S$ হলো ফিচার $i$ ব্যতীত অন্যান্য ফিচারের যেকোনো উপসেট।
- $\phi_i(x)$ নির্দেশ করে ফিচার $i$ রোগীর বর্তমান ঝুঁকিকে সাধারণ বেসলাইনের তুলনায় কতটা বৃদ্ধি ($+$) বা হ্রাস ($-$) করেছে।

---

# 7. AI Copilot & Multi-Step Tool Calling Engine / এআই কোপাইলট ও টুল ইঞ্জিন

### 7.1 Architecture & Tool Calling Registry Diagram
RespiGuard AI Copilot একটি সমন্বিত ক্লিনিক্যাল এজেন্ট হিসেবে কাজ করে। নিচে এর পূর্ণাঙ্গ আর্কিটেকচার ডায়াগ্রাম তুলে ধরা হলো:

```
+---------------------------------------------------------------------------------------------------+
|                        RESPIGUARD AI COPILOT TOOL CALLING REGISTRY ARCHITECTURE                   |
+---------------------------------------------------------------------------------------------------+
|                                                                                                   |
|                               +-------------------------------+                                   |
|                               | User Query via AI Copilot Chat|                                   |
|                               | (Bangla, Banglish, or English)|                                   |
|                               +---------------+---------------+                                   |
|                                               │                                                   |
|                                               ▼                                                   |
|                               +-------------------------------+                                   |
|                               | FastAPI /api/copilot/chat     |                                   |
|                               | - AES-256-GCM Encrypted Store |                                   |
|                               | - Session & User Isolation    |                                   |
|                               +---------------+---------------+                                   |
|                                               │                                                   |
|                                               ▼                                                   |
|                               +-------------------------------+                                   |
|                               | Groq LLM Engine               |                                   |
|                               | - Model: qwen/qwen3.8-27b     |                                   |
|                               | - Multi-Step Agentic Loop     |                                   |
|                               +---------------+---------------+                                   |
|                                               │                                                   |
|                     ┌─────────────────────────┼─────────────────────────┐                         |
|                     ▼                         ▼                         ▼                         |
|    +--------------------------------+ +-------------------------------+ +-----------------------+ |
|    | Tool 1: Live Sensor Telemetry  | | Tool 2: Satellite & Weather   | | Tool 3: Air Map & Hosp| |
|    | - ESP32 Node Indoor PM2.5      | | - Open-Meteo & CAMS Breakdown | | - 8 BD Divisions AQI  | |
|    | - PM1.0, PM10, Temp, Humidity  | | - Ozone, NO2, CO, SO2, UV, AQI| | - 24/7 Resp. Centers  | |
|    | - MQ135 Gas & Hardware Status  | | - Outdoor Safety Evaluation   | | - Hotlines: 999, 16263| |
|    +--------------------------------+ +-------------------------------+ +-----------------------+ |
|                     │                         │                         │                         |
|    +--------------------------------+ +-------------------------------+ +-----------------------+ |
|    | Tool 4: Explainable AI & TreeSHAP| Tool 5: Medications Tracker   | | Tool 6: Log Dose Puffs| |
|    | - ML Exacerbation Prediction   | | - Controller vs Rescue List   | | - Canister Decrement  | |
|    | - Top Risk & Protective Drivers| | - Dosage Schedules            | | - GINA Clinical Alert | |
|    | - Causal Rationale (Why Daiye) | | - Canister Countdown Doses    | | - Auto Inhaler Log    | |
|    +--------------------------------+ +-------------------------------+ +-----------------------+ |
|                     │                         │                         │                         |
|                     └─────────────────────────┼─────────────────────────┘                         |
|                                               ▼                                                   |
|                               +-------------------------------+                                   |
|                               | Tool 7 & 8: Doctor Directory &|                                   |
|                               | Direct Tele-Consultation      |                                   |
|                               | - Search BMDC Pulmonologists  |                                   |
|                               | - Send Consultation Messages  |                                   |
|                               +---------------+---------------+                                   |
|                                               │                                                   |
|                                               ▼                                                   |
|                               +-------------------------------+                                   |
|                               | Synthesized Trilingual Answer |                                   |
|                               | + Tool Invocation Badges & UI |                                   |
|                               +-------------------------------+                                   |
+---------------------------------------------------------------------------------------------------+
```

---

### 7.2 Native Function Calling Schema (8 Specialized Tools)

1. **`get_live_telemetry_and_sensors`:** ESP32 নোড থেকে ইনডোর লাইভ ডেটা ($PM_{1.0}, PM_{2.5}, PM_{10}$, Temp, Humidity, MQ135) ও হার্ডওয়্যার স্ট্যাটাস আনে।
2. **`get_outdoor_and_satellite_air_quality`:** রোগীর বর্তমান এলাকার জন্য ওপেন-মেটিও ও ইউরোপিয়ান CAMS স্যাটেলাইটের ৭টি দূষক (Ozone, $NO_2, CO, SO_2$, UV, AQI) এবং বাইরে যাওয়া নিরাপদ কি না তা যাচাই করে।
3. **`get_air_quality_map_and_emergency_facilities`:** বাংলাদেশের সকল বিভাগ ও জেলার জন্য লাইভ বায়ুর মান, নিকটস্থ ২৪/৭ সরকারি রেসপিরেটরি জরুরি হাসপাতাল ও অ্যাম্বুলেন্স হটলাইন (999, 16263) সরবরাহ করে।
4. **`get_xai_clinical_risk_and_shap`:** ২-ধাপের মেশিন লার্নিং ঝুঁকি প্রেডিকশন এবং কোন কোন পরিবেশগত উপাদান কত শতাংশ ঝুঁকি বাড়িয়েছে তার ট্রি-শ্যাপ ব্যাখ্যা প্রদান করে।
5. **`get_medications_and_schedule`:** রোগীর কন্ট্রোলার ও রেসকিউ ইনহেলার শিডিউল ও ক্যানিস্টারে অবশিষ্ট ডোজের হিসাব দেখায়।
6. **`log_medication_dose`:** রোগী ইনহেলার পাফ গ্রহণ করলে তা ক্যানিস্টার থেকে কমিয়ে ডাটাবেজে সংরক্ষণ করে এবং দিনে ২ বারের বেশি রেসকিউ পাফ লাগলে GINA সতর্কবার্তা দেয়।
7. **`search_doctors_directory`:** বিএমডিসি নিবন্ধিত বক্ষব্যাধি ও পালমোনোলজি বিশেষজ্ঞদের চেম্বার, ভিজিটিং আওয়ার ও লাইসেন্স অনুসন্ধান করে।
8. **`send_message_to_doctor`:** রোগীর স্বাস্থ্যগত প্রশ্ন বা জরুরি বার্তা সরাসরি চিকিৎসকের কনসাল্টেশন থ্রেডে নিরাপদে পৌঁছে দেয়।

---

### 7.3 Multi-Step Agentic Loop with Dynamic Groq Model Selection
এআই কোপাইলটে একটি উন্নত মাল্টি-স্টেপ এজেন্ট লুপ বাস্তবায়ন করা হয়েছে। কোনো ব্যবহারকারী যখন জটিল নির্দেশ দেন (যেমন: *"ডাক্তার জামানকে হ্যালো মেসেজ পাঠিয়ে দাও"*), তখন এজেন্ট একক টার্নে আটকে না থেকে স্বয়ংক্রিয়ভাবে মাল্টি-টার্ন সম্পাদন করে:
- **টার্ন ১:** `search_doctors_directory({"query": "Zaman"})` ডেকে চিকিৎসকের পরিচয় ও আইডি শনাক্ত করে।
- **টার্ন ২:** প্রাপ্ত তথ্যের ভিত্তিতে `send_message_to_doctor({"message_body": "Hello Dr. Zaman...", "doctor_id": "..."})` নির্বাহ করে।
- **টার্ন ৩:** সফলভাবে বার্তা পাঠানোর পর ব্যবহারকারীকে তার নিজস্ব ভাষায় ডেলিভারি কনফার্মেশন প্রদান করে।

---

### 7.4 Zero-Downtime Multilingual Local Fallback Engine (বাংলা, Banglish, English)
ইন্টারনেট বিভ্রাট বা গ্রক এপিআই রেট লিমিট (HTTP 429) ঘটলেও সিস্টেম কখনোই ডাউন হয় না। ব্যাকএন্ডে রয়েছে সম্পূর্ণ অটোনোমাস লোকাল ইঞ্জিন:
- **ভাষার সঠিক অনুকরণ (Language Mirroring):** ব্যবহারকারী খাঁটি বাংলায় প্রশ্ন করলে উত্তর হয় বাংলা হরফে; ব্যবহারকারী বাংলিশে ("baire jawa safe?") প্রশ্ন করলে উত্তর হয় খাঁটি বাংলিশে; আর ইংরেজিতে করলে ইংরেজিতে।
- **স্বাভাবিক ভাষা ও টাইপো রিকগনিশন:** যেমন `"docutr k helo u bolo"`, `"deo"`, কিংবা `"Satellite Atmospheric Pollutant Breakdown ar value koto h akhon"`-এর মতো জটিল বা টাইপোযুক্ত বাক্যও ব্যাকএন্ডে নিখুঁতভাবে পার্স হয়।

---

### 7.5 Authenticated AES-256-GCM Encrypted Chat History Storage
কোপাইলটের প্রতিটি মেসেজ ডাটাবেজে সুরক্ষিত রাখতে **AES-256-GCM** অথেনটিকেটেড এনক্রিপশন ব্যবহার করা হয়:
- মেসেজ ফরম্যাট: `enc:v1:<base64_iv>:<base64_ciphertext>:<base64_auth_tag>`
- রোগী ব্রাউজার রিলোড বা বন্ধ করে পুনরায় ওপেন করলেও তার অতীতের সকল চ্যাট ডিক্রিপ্ট হয়ে চোখের পলকে লোড হয়।
- ডাটাবেজের সরাসরি অ্যাডমিনও রোগীর মেসেজ পড়তে পারে না।

---

# 8. Security, Authentication & Role-Based Access Control (RBAC)

```
                            [User Lands on Auth Portal]
                                         │
                                         ▼
                     [Step 1: Role Selection & Credential Entry]
                     - Patient: Full Name, Email, Age, Best PEFR
                     - Doctor:  Full Name, Email, BMDC License, Hospital
                                         │
                                         ▼
                     [Step 2: 6-Digit Email OTP Dispatch via SMTP]
                     - Cryptographic Random Token (Crypto-Secure RNG)
                     - 10-Minute Expiration Time-to-Live (TTL)
                     - Sent to User's Official Inbox
                                         │
                                         ▼
                     [Step 3: OTP Verification & Registration]
                     - Verifies code against stored PBKDF2 hash
                     - Generates Unique Patient ID (e.g. PAT-2201031)
                     - Issues Signed HS256 JWT Token with Role Claim
                                         │
                     ┌───────────────────┴───────────────────┐
                     ▼                                       ▼
        [Role: Patient Dashboard]                [Role: Doctor Workspace]
        - Live Sensors & Radial Rings           - Verified BMDC Specialist Badge
        - Explainable AI (TreeSHAP)             - Roster of Paired Patients
        - AI Copilot Assistant Active           - AI Copilot Disabled (Clean Screen)
        - Inhaler & Canister Tracker            - Real-time Patient Telemetry Audit
        - Send Advice Requests to Doctor        - Respond to Clinical Threads
```

### 8.1 6-Digit Cryptographic Email OTP Flow (SMTP)
সিস্টেম পাসওয়ার্ড হ্যাক হওয়া বা ফিশিং ঠেকাতে পাসওয়ার্ডহীন **ইমেইল ওটিপি (Email OTP)** প্রোটোকল ব্যবহার করে:
1. ব্যবহারকারী তার ইমেইল প্রদান করলে ব্যাকএন্ড ৬-সংখ্যার ক্রিপ্টোগ্রাফিক র‍্যান্ডম কোড তৈরি করে।
2. কোডটি গুগলের নিরাপদ **SMTP (Port 587, TLS)** গেটওয়ের মাধ্যমে সরাসরি ব্যবহারকারীর ইনবক্সে প্রেরণ করা হয়।
3. ওটিপি কোডটির মেয়াদ থাকে সর্বোচ্চ **১০ মিনিট** এবং ৩ বার ভুল কোড দিলে রিকোয়েস্ট লক হয়ে যায়।

---

### 8.2 Unique Patient Identifier (`PAT-2201031`) & Doctor BMDC Verification
- **Patient ID Code:** প্রতিটি রোগী সাইনআপ করার পর একটি অনন্য স্থায়ী কোড পান (যেমন: `PAT-2201031`)। রোগী এই কোডটি তার চিকিৎসকের সাথে শেয়ার করলে চিকিৎসক তার ওয়ার্কস্পেসে রোগীকে পেয়ার করতে পারেন।
- **BMDC Registration:** চিকিৎসকের সাইনআপের সময় বাংলাদেশ মেডিকেল অ্যান্ড ডেন্টাল কাউন্সিল (BMDC) রেজিস্ট্রেশন নম্বর ও বর্তমান কর্মস্থল যাচাই করে ভেরিফাইড ব্যাজ প্রদান করা হয়।

---

# 9. Satellite Atmospheric Metrology & Air Quality Map / স্যাটেলাইট ও ম্যাপ

```
     [Open-Meteo & Copernicus CAMS API]             [Local ESP32 Hardware Node]
      (Satellite Ambient Atmospheric Data)           (Micro-Indoor Environment)
                      │                                          │
                      ▼                                          ▼
     ┌──────────────────────────────────┐       ┌──────────────────────────────────┐
     │ 7 Outdoor Satellite Pollutants   │       │ Real-Time Indoor Sensors         │
     │ - PM2.5: 28.5 µg/m³              │       │ - PM2.5: 12.8 µg/m³              │
     │ - PM10:  45.0 µg/m³              │       │ - PM1.0: 9.2 µg/m³               │
     │ - Ozone (O3): 38.0 µg/m³         │       │ - PM10:  22.4 µg/m³              │
     │ - Nitrogen Dioxide: 22.0 µg/m³   │       │ - Temp:  25.4 °C                 │
     │ - Carbon Monoxide: 410.0 µg/m³   │       │ - Humidity: 58.2 %               │
     │ - Sulphur Dioxide: 9.5 µg/m³     │       │ - MQ135 VOC: 408 ADC             │
     │ - UV Index: 5.0 (Moderate)       │       │ - Status: ONLINE                 │
     └────────────────┬─────────────────┘       └────────────────┬─────────────────┘
                      │                                          │
                      └─────────────────────┬────────────────────┘
                                            │
                                            ▼
                    [Real-Time Ambient Comparison & Telehealth Map]
                    - Identifies if danger is INDOORS (cooking/dust) or OUTDOORS (smog)
                    - Leaflet Map with Bangladesh Stations (Dhaka, Gazipur, Sylhet, etc.)
                    - Nearest 24/7 Oxygen & Nebulization Centers + 999/16263 Hotlines
```

### 9.1 Open-Meteo & Copernicus CAMS 7-Pollutant Atmospheric Engine
RespiGuard কেবল ইনডোর সেন্সরে সীমাবদ্ধ নয়; এটি ইউরোপিয়ান ইউনিয়নের **Copernicus Atmosphere Monitoring Service (CAMS)** এবং **Open-Meteo** স্যাটেলাইট এপিআই থেকে প্রতি ঘণ্টায় বায়ুমণ্ডলের ৭টি প্রধান দূষক রিডিং লাইভ ইনজেস্ট করে:
- **$PM_{2.5}$ & $PM_{10}$:** আউটডোর ভাসমান ধূলিকণা
- **Ground-Level Ozone ($O_3$):** অতিবেগুনি রশ্মি ও ট্রাফিকের ধোঁয়ার রাসায়নিক বিক্রিয়ায় উৎপন্ন তীব্র ফুসফুস প্রদাহক গ্যাস
- **Nitrogen Dioxide ($NO_2$):** ডিজেল গাড়ি ও শিল্পকারখানার নির্গমন
- **Carbon Monoxide ($CO$):** অসম্পূর্ণ দহনের বিষাক্ত গ্যাস
- **Sulphur Dioxide ($SO_2$):** কয়লা ও ইটভাটার ক্ষতিকর সালফার গ্যাস
- **UV Index:** সূর্যালোকের অতিবেগুনি বিকিরণ স্তর

---

### 9.2 Interactive Leaflet Air Quality Map (Bangladesh Divisions)
ফ্রন্টএন্ডে রয়েছে সম্পূর্ণ ইন্টারঅ্যাক্টিভ **লিফলেট (Leaflet.js)** ভিত্তিক এয়ার কোয়ালিটি ও ইমার্জেন্সি ম্যাপ:
- ঢাকা, গাজীপুর (কালিয়াকৈর), চট্টগ্রাম, সিলেট, রাজশাহী, খুলনা, বরিশাল, রংপুর ও ময়মনসিংহ বিভাগের সার্বক্ষণিক একিউআই পিন।
- প্রতিটি পিনে ক্লিক করলে সবচেয়ে নিকটবর্তী **২৪/৭ সরকারি সেন্ট্রাল অক্সিজেন ও নেবুলাইজেশন সুবিধাযুক্ত হাসপাতালের ঠিকানা, রিসেপশন হটলাইন ও অ্যাম্বুলেন্স নম্বর** তাৎক্ষণিক ভেসে ওঠে।

---

# 10. Smart Inhaler Tracker & GINA Clinical Adherence / স্মার্ট ইনহেলার

```
                      [Patient Prescribed Regimen]
                                   │
         ┌─────────────────────────┴─────────────────────────┐
         ▼                                                   ▼
[Controller Inhaler (ICS)]                         [Rescue Reliever (SABA)]
e.g. Budesonide / Fluticasone                      e.g. Salbutamol / Ventolin
- Taken regularly (Morning & Night)                - Taken during sudden acute attack
- Prevents chronic airway inflammation             - Fast-acting bronchodilation
- Tracked morning (08:00) & evening (20:00)        - Maximum safe frequency: <=2 puffs/day
         │                                                   │
         └─────────────────────────┬─────────────────────────┘
                                   │
                                   ▼
                   [Automatic Canister Dose Counter]
                   - Patient clicks "Log Dose" or tells AI Copilot
                   - Deducts puff count from remaining doses (e.g. 120 -> 119)
                   - Emits GINA Clinical Overdose Alert if rescue puffs > 2/day
```

### 10.1 Controller vs. Rescue Reliever Differentiation
অ্যাজমা নিয়ন্ত্রণে গ্লোবাল গাইডলাইন (GINA) অনুযায়ী দুই ধরনের ওষুধ ব্যবহৃত হয়:
1. **কন্ট্রোলার (Controller):** ইনহেলড কর্টিকোস্টেরয়েড, যা প্রতিদিন সকালে ও রাতে নির্দিষ্ট সময়ে গ্রহণ করে শ্বাসনালী প্রদাহমুক্ত রাখতে হয়।
2. **রেসকিউ বা রিলিভার (Rescue):** সালবুটামল বা ভেন্টোলিন, যা হঠাৎ তীব্র শ্বাসকষ্ট শুরু হলে তাৎক্ষণিক শ্বাসনালী প্রসারিত করার জন্য গ্রহণ করা হয়।

### 10.2 GINA Overdose Safety Alerts
- যদি কোনো রোগী ২৪ ঘণ্টার মধ্যে **২টির বেশি রেসকিউ পাফ** গ্রহণ করেন, সিস্টেম স্বয়ংক্রিয়ভাবে সতর্ক করে যে রোগীর স্বাভাবিক অ্যাজমা নিয়ন্ত্রণ হারিয়ে গেছে এবং তাকে অবিলম্বে চিকিৎসকের পরামর্শ নিতে হবে।
- প্রতিটি ক্যানিস্টারে কয়টি ডোজ অবশিষ্ট আছে তা ড্যাশবোর্ডে ও কোপাইলটে লাইভ প্রদর্শিত হয়, যাতে রোগী শেষ হওয়ার আগেই নতুন ইনহেলার সংগ্রহ করতে পারেন।

---

# 11. Frontend User Interface Suite (React 18 + Tailwind CSS)

### 11.1 Cyberpunk / Dark Emerald Aesthetic & Design Tokens
ফ্রন্টএন্ডটি উচ্চমানের ডার্ক মোড সাইবারপাঙ্ক এমারেল্ড থিমে নির্মিত:
- **Background Palette:** Ultra-deep Slate & Pitch Emerald (`#030712`, `#064e3b`, `#022c22`)
- **Accent Neon Tokens:**
  - 🟢 `Emerald-400` (`#34d399`): Safe Zone, Low Risk, Online Telemetry
  - 🟡 `Amber-400` (`#fbbf24`): Moderate Exacerbation Warning
  - 🔴 `Rose-500` (`#f43f5e`): High Hazard Danger, GINA Alerts
  - 🌐 `Cyan-400` (`#22d3ee`): Satellite Weather & Map Badges
- **Glassmorphism:** `backdrop-blur-md` এবং সেমি-ট্রান্সপারেন্ট বর্ডার যা ড্যাশবোর্ডকে একটি প্রিমিয়াম মেডিকেল কনসোলের রূপ দেয়।

---

### 11.2 Component Hierarchy & Visual Analytics
1. **`Header.jsx`:** ব্র্যান্ড লোগো, কানেক্টিভিটি স্ট্যাটাস, ওটিপি প্রোফাইল ম্যানেজার ও রোল ইন্ডিকেটর।
2. **`EnvironmentalConditionCard.jsx`:** কনসেন্ট্রিক রেডিয়াল গেজ (Concentric Radial Rings) দিয়ে $PM_{2.5}$, তাপমাত্রা, আর্দ্রতা ও বায়ুর গুণমান প্রদর্শন।
3. **`XAIPage.jsx`:** ট্রি-শ্যাপ ওয়াটারফল বিশ্লেষণ, কোন উপাদান কত শতাংশ দায়ী তার রঙিন অনুভূমিক ক্যাপসুল বার চার্ট।
4. **`AirMapPage.jsx`:** বাংলাদেশের সকল বিভাগের লাইভ এয়ার ম্যাপ ও ইমার্জেন্সি হাসপাতাল হটলাইন।
5. **`MedicationsPage.jsx`:** ইনহেলার ডোজ ট্র্যাকার, ক্যানিস্টার কাউন্টডাউন ও ডোজ লগিং।
6. **`DoctorDashboard.jsx`:** চিকিৎসকদের জন্য তৈরি ডেডিকেটেড পোর্টাল, পেয়ার করা রোগীদের তালিকা ও রিমোট ক্লিনিক্যাল রেসপন্স।
7. **`AICopilotModal.jsx`:** সাইজ অ্যাডজাস্টেবল, ড্র্যাগেবল এআই চ্যাট কনসোল যা ট্রাই-লিঙ্গুয়াল কোপাইলটের মাধ্যমে সকল কাজ সম্পন্ন করে।

---

# 12. Complete REST API Reference & Data Contracts / এপিআই রেফারেন্স

| HTTP Method | Endpoint URL | প্যারামিটার / পে-লোড | বর্ণনা ও ক্লিনিক্যাল উদ্দেশ্য |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/telemetry/latest` | — | সর্বশেষ ইনডোর সেন্সর রিডিং ও ২-ধাপের ML ঝুঁকি প্রেডিকশন আনে |
| `POST`| `/api/telemetry` | `temperature, humidity, pm1_0, pm2_5, pm10, mq135` | ESP32 বা সিমুলেটর থেকে সেন্সর ডেটা গ্রহণ ও সংরক্ষণ |
| `POST`| `/api/auth/request-otp` | `email, role, full_name, age, pef_best, bmdc_number` | চিকিৎসকের বা রোগীর ইমেইলে ৬-সংখ্যার ক্রিপ্টোগ্রাফিক ওটিপি পাঠায় |
| `POST`| `/api/auth/verify-otp` | `email, otp_code` | ওটিপি যাচাই করে অ্যাক্সেস টোকেন (JWT) ও Patient ID ইস্যু করে |
| `GET` | `/api/copilot/status` | — | এআই কোপাইলট স্ট্যাটাস ও সক্রিয় মডেল (`qwen/qwen3.8-27b`) প্রদান করে |
| `POST`| `/api/copilot/chat` | `message, history` | এআই কোপাইলট টার্ন নির্বাহ ও মাল্টি-স্টেপ টুল কলিং সম্পন্ন করে |
| `GET` | `/api/copilot/history`| — | ব্যবহারকারীর পূর্ববর্তী সকল এনক্রিপ্টেড চ্যাট ডিক্রিপ্ট করে প্রদর্শন করে |
| `DELETE`|`/api/copilot/history`| — | চ্যাট হিস্ট্রি মুছে ফেলে |
| `GET` | `/api/environment/latest`| — | ওপেন-মেটিও ও CAMS থেকে সর্বশেষ ৭টি স্যাটেলাইট দূষক মান আনে |
| `POST`| `/api/environment/satellite`| `location, pm2_5, pm10, ozone, no2, co, so2, uv` | স্যাটেলাইট পরিবেশগত পরিমাপ ডাটাবেজে রেকর্ড করে |
| `GET` | `/api/medications` | — | রোগীর বর্তমান ওষুধের শিডিউল ও ক্যানিস্টার ডোজ তালিকা আনে |
| `POST`| `/api/medications/log` | `medication_id, dose_type, puffs_count` | ওষুধ গ্রহণের পাফ লগ করে ও ক্যানিস্টার আপডেট করে |
| `GET` | `/api/doctors/directory`| `query, location` | বিএমডিসি ভেরিফাইড পালমোনোলজিস্ট ডিরেক্টরি অনুসন্ধান |
| `POST`| `/api/doctor/messages/send`| `doctor_id, subject, message_body` | চিকিৎসকের কাছে এনক্রিপ্টেড পরামর্শ বার্তা প্রেরণ |

---

# 13. Setup, Installation, Testing & Verification Guide / ব্যবহারের নিয়মাবলী

### ধাপ ১: রিপোজিটরি ক্লোন ও এনভায়রনমেন্ট প্রস্তুতি
```bash
git clone https://github.com/Masud744/RespiGuard.git
cd RespiGuard
```

### ধাপ ২: পাইথন ভার্চুয়াল এনভায়রনমেন্ট ও ডিপেন্ডেন্সি
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
```

### ধাপ ৩: এনভায়রনমেন্ট কনফিগারেশন (`.env`)
রুট ডিরেক্টরি ও `backend/` ডিরেক্টরিতে `.env` ফাইল প্রস্তুত করুন:
```env
# Groq Cloud AI Copilot (Active tool-calling model)
GROQ_API_KEY=gsk_your_groq_api_key_here
GROQ_MODEL=qwen/qwen3.8-27b

# Email OTP Service (Gmail SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_16_digit_google_app_password

# Database Encryption Key
AES_256_SECRET_KEY=your_32_character_encryption_key_here
```

### ধাপ ৪: স্বয়ংক্রিয় টেস্ট রান ও ভেরিফিকেশন (Automated Tests)
সকল ব্যাকএন্ড ও কোপাইলট টেস্ট যাচাই করতে চালান:
```bash
# শুধুমাত্র এআই কোপাইলট ও স্যাটেলাইট ব্রেকডাউন টেস্ট
pytest tests/test_agent_copilot_service.py -v

# সম্পূর্ণ টেস্ট স্যুট (৬৭টি টেস্ট)
pytest -v
```
*(বর্তমানে সকল ৬৭টি টেস্ট ১০০% পাসের নিশ্চয়তা দেয়)*

### ধাপ ৫: ব্যাকএন্ড সার্ভার চালু করা
```bash
python3 -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
- ব্যাকএন্ড সার্ভার: `http://127.0.0.1:8000`
- সোয়াগার ইন্টারঅ্যাক্টিভ ডক্স: `http://127.0.0.1:8000/docs`

### ধাপ ৬: React ফ্রন্টএন্ড ড্যাশবোর্ড চালু করা
নতুন টার্মিনাল ওপেন করে:
```bash
cd frontend
npm install
npm run dev
```
- ফ্রন্টএন্ড ড্যাশবোর্ড: `http://localhost:5173`

### ধাপ ৭: লাইভ সেন্সর সিমুলেটর চালানো (ঐচ্ছিক)
```bash
python3 sensor_simulator.py --interval 5 --spike
```

---

# 14. Future Roadmap & Academic Citation

### 14.1 ভবিষ্যৎ উন্নয়ন পরিকল্পনা
1. **TinyML on ESP32 Microcontroller (Edge Inference):** CatBoost বা Random Forest ডিসিশন ট্রিকে সরাসরি C++ কোডে রূপান্তর করে মাইক্রোকন্ট্রোলারে ফ্ল্যাশ করা, যাতে ইন্টারনেট ছাড়াও ডিভাইস তাৎক্ষণিক সাইরেন বাজাতে পারে।
2. **Smart Inhaler Bluetooth Low Energy (BLE) Add-on:** রোগীর ইনহেলারের শীর্ষে প্রেসার ও অ্যাকোস্টিক সেন্সর যুক্ত করে পাফ গ্রহণের সময় নিজে থেকেই ব্লুটুথের মাধ্যমে অ্যাপে রেকর্ড পাঠানো।
3. **Hospital EHR / FHIR Interoperability:** জরুরি Red Zone অ্যালার্টগুলো সরাসরি হাসপাতালের ইলেকট্রনিক হেলথ রেকর্ড (HL7/FHIR) ডাটাবেজে প্রেরণ করা।

---

### 14.2 Academic Citation

```bibtex
@misc{respiguard2026,
  author = {Shahriar Alom Masud and RespiGuard Research Team},
  title = {RespiGuard (AuraBreath AI): Explainable AI-Powered Real-Time Portable Asthma Exacerbation Risk Prediction, Satellite Atmospheric Telemetry & Telehealth System},
  year = {2026},
  howpublished = {Department of Computer Science & Engineering, Embedded Systems & ML Capstone Project},
  url = {https://github.com/Masud744/RespiGuard}
}
```
