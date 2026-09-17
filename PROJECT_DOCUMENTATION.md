# RespiGuard (AuraBreath AI) — Complete System Architecture, Dataset Engineering, ML & Hardware Documentation

> **Project Name:** RespiGuard / AuraBreath AI (Explainable AI-Powered Real-Time Portable Asthma Exacerbation Risk Prediction & Telehealth Monitoring System)  
> **Course:** Embedded Systems & Machine Learning Project (3-2 Semester)  
> **Target Audience:** Developers, Researchers, Embedded Engineers, ML Practitioners, and Medical Informatics Evaluators  
> **Document Version:** 2.0.0 (Production Master)  
> **Date:** September 2026  
> **Scope:** Complete Master Technical Reference, Architecture, Dataset Lineage, ML Equations, Hardware Schematics, API Schematics & Development Guide (15+ Pages Equivalent)

---

## 📑 সূচিপত্র / Table of Contents

1. [Executive Summary & Project Vision / প্রকল্পের মূল উদ্দেশ্য](#1-executive-summary--project-vision)
   - 1.1 The Clinical Challenge (অ্যাজমার শারীরিক ও পরিবেশগত প্রভাব)
   - 1.2 The Technological Gap (বর্তমান প্রযুক্তির সীমাবদ্ধতা)
   - 1.3 The RespiGuard Solution & High-Level Architecture (আমাদের সমাধান)
2. [End-to-End System Architecture / সামগ্রিক আর্কিটেকচার](#2-end-to-end-system-architecture)
   - 2.1 5-Tier Decoupled Architecture
   - 2.2 Telemetry Lifecycle & Communication Flow
3. [IoT Hardware Layer & Sensor Schematics / হার্ডওয়্যার ডিজাইন ও সেন্সর](#3-iot-hardware-layer--sensor-schematics)
   - 3.1 Hardware Bill of Materials (BOM) & Physiological Relevance
   - 3.2 Electrical Pinout & Circuit Schematics (ESP32 Wiring Matrix)
   - 3.3 Microcontroller Firmware Workflow (C++ / Arduino IDE)
   - 3.4 Physical Sensing Protocols (PMS5003 Laser UART, DHT22 OneWire, MQ135 ADC)
4. [Dataset Engineering & Ground-Truth Methodology / ডেটাসেট তৈরি ও গবেষণা ভিত্তি](#4-dataset-engineering--ground-truth-methodology)
   - 4.1 Grounded Clinical & Academic Foundations (Nature 2023 & IEEE 2021 With Links)
   - 4.2 Raw Source Tables & Relational Fusion Pipeline
   - 4.3 Peak Expiratory Flow Rate ($PEFR$) & Clinical Risk Labeling Logic
   - 4.4 Sensor Physics-Calibrated $PM_{1.0}$ Laser Synthesis
   - 4.5 Generated Output Datasets (`primary`, `extended`, `daily`)
   - 4.6 Dataset Validation & Mathematical Invariant Checks
5. [Machine Learning Pipeline & Model Architectures / মেশিন লার্নিং মডেল](#5-machine-learning-pipeline--model-architectures)
   - 5.1 Baseline Model Benchmarking (Logistic Regression, Random Forest, XGBoost)
   - 5.2 Cross-Validation Protocols (5-Fold Stratified & Patient-Wise GroupKFold)
   - 5.3 Proposed 2-Stage Hierarchical Classification Architecture
   - 5.4 Mathematical Formulations for Stage 1 (CatBoost) & Stage 2 (XGBoost)
   - 5.5 Feature Preprocessing Pipeline (StandardScaler & OneHotEncoder)
   - 5.6 Comprehensive Performance Benchmark & Confusion Matrix Analysis
6. [Explainable AI (XAI) & TreeSHAP Attribution Engine / ব্যাখ্যামূলক এআই](#6-explainable-ai-xai--treeshap-attribution-engine)
   - 6.1 Game-Theoretic Shapley Formulations in Clinical Risk
   - 6.2 Local Feature Attribution & Waterfall Computation
   - 6.3 Global Cohort Importance Rankings
   - 6.4 Automated Clinical Narrative & Medical Recommendation Generation
7. [Backend Architecture & Cloud Infrastructure (FastAPI + Supabase)](#7-backend-architecture--cloud-infrastructure-fastapi--supabase)
   - 7.1 Backend Micro-Architecture & Directory Structure
   - 7.2 Supabase PostgreSQL Database Schema & Relations (ERD)
   - 7.3 Complete REST API Specifications & Reference Table
   - 7.4 Email OTP Authentication & Cryptographic Session Lifecycle
   - 7.5 Background Non-Blocking IMAP Auto-Sync Worker (Two-Way Doctor Consultation)
8. [Frontend User Interface & Visual Analytics Suite (React + Tailwind CSS)](#8-frontend-user-interface--visual-analytics-suite-react--tailwind-css)
   - 8.1 Cyberpunk / Dark Emerald Design System & Color Tokens
   - 8.2 Component Hierarchy & Visual Analytics Breakdown
   - 8.3 Interactive Telemetry Simulator & Live State Polling Engine
9. [IoT Telemetry Simulator (`sensor_simulator.py`)](#9-iot-telemetry-simulator-sensor_simulatorpy)
   - 9.1 Brownian Motion & Mean-Reverting Atmospheric Physics
   - 9.2 CLI Arguments & Injection of Synthetic Pollution Spikes
10. [Comprehensive Setup, Installation & Execution Guide / ব্যবহারের নিয়মাবলী](#10-comprehensive-setup-installation--execution-guide)
    - 10.1 Environment Prerequisites
    - 10.2 Configuration File Setup (`.env`)
    - 10.3 Backend Installation & Start
    - 10.4 Frontend Installation & Start
    - 10.5 Simulator Execution & Verification
11. [Troubleshooting & Common Failure Modes / ত্রুটি ও সমাধান](#11-troubleshooting--common-failure-modes)
12. [Future Roadmap & Developer Continuation Guide / ভবিষ্যৎ উন্নয়ন পরিকল্পনা](#12-future-roadmap--developer-continuation-guide)
    - 12.1 TinyML on ESP32 Microcontroller (Edge Inference)
    - 12.2 Cross-Platform Mobile Application (React Native / Flutter with BLE)
    - 12.3 Smart Inhaler Acoustic/Capacitive Add-on
    - 12.4 FHIR / HL7 EHR Hospital Interoperability

---

# 1. Executive Summary & Project Vision / প্রকল্পের মূল উদ্দেশ্য

### 1.1 The Clinical Challenge (অ্যাজমার শারীরিক ও পরিবেশগত প্রভাব)
Asthma (হাঁপানি) হলো মানব ফুসফুসের শ্বাসনালীর একটি দীর্ঘস্থায়ী প্রদাহজনিত রোগ (chronic inflammatory respiratory disease)। বিশ্ব স্বাস্থ্য সংস্থার (WHO) হিসাব অনুযায়ী, বিশ্বে **২৬০ মিলিয়নেরও বেশি মানুষ** অ্যাজমায় আক্রান্ত এবং প্রতি বছর **৪,৫০,০০০ জনের বেশি মানুষ** অ্যাজমা অ্যাটাকের কারণে মৃত্যুবরণ করেন। 

অ্যাজমা রোগীদের শ্বাসনালী স্বাভাবিক মানুষের তুলনায় অত্যন্ত সংবেদনশীল (hyper-responsive)। দৈনন্দিন পরিবেশের কিছু বিশেষ উপাদান আকস্মিকভাবে অ্যাজমা অ্যাটাক বা **Exacerbation** ঘটাতে পারে:
1. **ক্ষতিকর ভাসমান ধূলিকণা ($PM_{2.5}, PM_{10}, PM_{1.0}$):** 
   - $PM_{10}$ (Coarse dust, ধূলিকণা ও পরাগরেণু): উপরের শ্বাসনালী এবং গলায় চুলকানি ও কাশির সৃষ্টি করে।
   - $PM_{2.5}$ (Fine particles, ধোঁয়া ও যানবাহন নির্গমন): ব্রঙ্কিওলের গভীরে প্রবেশ করে কোষীয় প্রদাহ এবং মিউকাস ক্ষরণ বাড়িয়ে দেয়।
   - $PM_{1.0}$ (Ultrafine aerosol): সরাসরি অ্যালভিওলাই (Alveoli) বা ফুসফুসের রক্ত সংবহন স্তরে পৌঁছায় এবং তীব্র ব্রঙ্কোস্পাজম (bronchospasm) ঘটায়।
2. **আবহাওয়ার আকস্মিক পরিবর্তন (তাপমাত্রা ও আর্দ্রতা / Temperature & Relative Humidity):**
   - হঠাৎ তাপমাত্রা কমে যাওয়া (Cold air): শ্বাসনালীর মিউকোসাকে শুষ্ক করে এবং প্যারাসিমপ্যাথেটিক রিফ্লেক্সের মাধ্যমে শ্বাসনালী সংকুচিত করে।
   - অতিরিক্ত আর্দ্রতা (High Humidity > 70%): বাতাসে ছত্রাকের স্পোর (mold spores) ও ধুলার মাইট বৃদ্ধি করে যা তীব্র অ্যালার্জিক প্রতিক্রিয়া সৃষ্টি করে।
3. **বিষাক্ত গ্যাস ও ধোঁয়া ($MQ\text{-}135$ Detection):**
   - বাতাসে $CO_2, NO_x$, অ্যামোনিয়া, সিগারেট ও রান্নার ধোঁয়া শ্বাসনালীর স্নায়ুকে উত্তেজিত করে তাৎক্ষণিক শ্বাসকষ্ট ঘটায়।

---

### 1.2 The Technological Gap (বর্তমান প্রযুক্তির সীমাবদ্ধতা)
বর্তমানে বাজারে বিভিন্ন ওয়েদার অ্যাপ এবং প্রচলিত এয়ার কোয়ালিটি মনিটর রয়েছে, কিন্তু অ্যাজমা রোগীদের জন্য সেগুলোতে তিনটি গুরুতর সীমাবদ্ধতা দেখা যায়:
1. **Macro-Regional Data vs. Micro-Environment Disconnect:** আবহাওয়া অ্যাপগুলো পুরো শহরের একটি নির্দিষ্ট স্টেশনের গড় তথ্য দেখায়। কিন্তু একজন রোগীর ঘরের ভেতরের তাৎক্ষণিক ধোঁয়া, রান্নাঘরের গ্যাস বা ব্যক্তিগত সংলগ্ন এলাকার বায়ুদূষণ সাধারণ অ্যাপ ধরতে পারে না।
2. **The "Black-Box" Problem:** সাধারণ কৃত্রিম বুদ্ধিমত্তা (AI) বা অ্যালগরিদম শুধু একটি ঝুঁকি স্কোর দেখায়, কিন্তু *কেন* এই ঝুঁকি বাড়ল (তাপমাত্রা কমার কারণে নাকি $PM_{2.5}$ বৃদ্ধির কারণে) তা ব্যাখ্যা করতে পারে না। ফলে রোগী বুঝতে পারেন না তার ঠিক কী পদক্ষেপ নেওয়া উচিত।
3. **ডাক্তার ও রোগীর মধ্যে তাৎক্ষণিক সংযোগের অভাব:** কোনো এলাকায় বায়ুদূষণ বেড়ে গেলে রোগী সরাসরি তার পালমোনোলজিস্ট (বক্ষব্যাধি বিশেষজ্ঞ)-কে তৎক্ষণাৎ তার পরিবেশগত ডেটাসহ জানাতে পারেন না।

---

### 1.3 The RespiGuard Solution & High-Level Architecture (আমাদের সমাধান)
**RespiGuard (AuraBreath AI)** হলো একটি সমন্বিত পোর্টেবল IoT ডিভাইস ও ব্যাখ্যাযোগ্য কৃত্রিম বুদ্ধিমত্তা (Explainable AI - XAI) ভিত্তিক সিস্টেম, যা রোগীর ব্যক্তিগত পরিবেশের বায়ুর মান রিয়েল-টাইমে পরিমাপ করে এবং ২-ধাপের হায়ারার্কিক্যাল মেশিন লার্নিং মডেলের মাধ্যমে অ্যাজমা অ্যাটাকের ঝুঁকি নির্ভুলভাবে পূর্বাভাস দেয়।

#### প্রকল্পের প্রধান বৈশিষ্ট্যসমূহ (Key System Highlights):
- **পোর্টেবল IoT সেন্সিং নোড:** ESP32 মাইক্রোকন্ট্রোলার, লেজার পার্টিকল সেন্সর (**PMS5003**), ডিজিটাল তাপমাত্রা ও আর্দ্রতা সেন্সর (**DHT22**), এবং ক্ষতিকর গ্যাস সেন্সর (**MQ135**)।
- **২-ধাপের হায়ারার্কিক্যাল মেশিন লার্নিং (2-Stage Hierarchical ML):** CatBoost (Safety Gate) এবং XGBoost (Severity Triage) এর সমন্বয়ে গঠিত মডেল, যা $93.75\%$ হাই-রিস্ক রিকল অর্জন করে।
- **ব্যাখ্যাযোগ্য এআই (TreeSHAP Explainable AI):** প্রতিটি পূর্বাভাসের জন্য গাণিতিকভাবে দেখায় কোন সেন্সরটি ঝুঁকি বাড়ানোর পেছনে কত শতাংশ দায়ী এবং স্বয়ংক্রিয়ভাবে চিকিৎসকের নির্দেশনামূলক বার্তা তৈরি করে।
- **দ্বিমুখী ডাক্তার কনসালটেশন ও জিমেইল অটো-সিঙ্ক (Two-Way Doctor Teleconsultation with IMAP Auto-Sync):** রোগী ড্যাশবোর্ড থেকে চিকিৎসকের সাথে যোগাযোগ করতে পারেন। চিকিৎসক তার নিজস্ব জিমেইল অ্যাপ থেকে সরাসরি রিপ্লাই দিলে ব্যাকগ্রাউন্ড IMAP লিসেনার স্বয়ংক্রিয়ভাবে তা রোগীর ড্যাশবোর্ডে সিঙ্ক করে দেয়।
- **সাইবারপাঙ্ক ডার্ক এমারেল্ড ভিজ্যুয়াল ড্যাশবোর্ড (React + Tailwind CSS):** কনসেন্ট্রিক রেডিয়াল এয়ার কোয়ালিটি গেজ, ইন্টারঅ্যাক্টিভ সেন্সর সিমুলেটর, পালস ওয়েভফর্ম এবং রিয়েল-টাইম গ্রাফ।

```
+-----------------------------------------------------------------------------------------+
|                                  RESPIGUARD ECOSYSTEM                                   |
+-----------------------------------------------------------------------------------------+
|                                                                                         |
|  [ESP32 IoT Node] / [Python Sensor Simulator]                                           |
|         │                                                                               |
|         │  HTTP POST /api/telemetry (প্রতি ৩০ সেকেন্ডে সেন্সর ডেটা)                      |
|         ▼                                                                               |
|  +-----------------------------------------------------------------------------------+  |
|  |                             FastAPI Backend Server                                |  |
|  |  +---------------------------+  +----------------------+  +---------------------+  |  |
|  |  | 2-Stage ML Pipeline       |  | TreeSHAP Engine      |  | Auth & OTP Manager  |  |  |
|  |  | (CatBoost + XGBoost)      |  | (Feature Impacts)    |  | (Gmail SMTP 587)    |  |  |
|  |  +---------------------------+  +----------------------+  +---------------------+  |  |
|  |  +---------------------------+  +----------------------+  +---------------------+  |  |
|  |  | Background IMAP Worker    |  | Supabase REST Client |  | Alert Dispatcher    |  |  |
|  |  | (Auto-Sync Doctor Emails) |  | (PostgreSQL Cloud)   |  | (Red-Alert Emails)  |  |  |
|  |  +---------------------------+  +----------------------+  +---------------------+  |  |
|  +-----------------------------------------------------------------------------------+  |
|         │                                              │                                │
|         ▼                                              ▼                                ▼
|  [Supabase Database]                         [React Vite Dashboard]           [Doctor's Gmail]
|  - user_profiles                             - Emerald Dark Theme             - Email with PID
|  - telemetry_readings                        - Radial Air Rings               - Direct Reply ->
|  - patient_doctors                           - XAI Waterfall Cards              IMAP Auto-Sync
|  - doctor_messages                           - Interactive Simulators                          |
+-----------------------------------------------------------------------------------------+
```

---

# 2. End-to-End System Architecture / সামগ্রিক আর্কিটেকচার

RespiGuard প্ল্যাটফর্মটি ৫টি প্রধান স্তরে (Decoupled Tiers) বিভক্ত:

```
[IoT Node: ESP32 + Sensors]  ──>  [FastAPI Backend :8000]  <──>  [Supabase Database]
                                          │                                │
                                          ├──> [2-Stage ML + TreeSHAP]     │
                                          │                                │
                                          ├──> [SMTP Outbound (Port 587)]  │
                                          │           │                    │
                                          │           ▼                    │
                                          │      [Doctor's Gmail]          │
                                          │           │                    │
                                          │           ▼ (Reply)            │
                                          └──> [IMAP Listener (Port 993)] ─┘
                                                      │
                                                      ▼
                                          [React 18 Vite Dashboard]
```

### 2.1 ডেটা আদান-প্রদান ও লাইফসাইকেল (System Flow & Lifecycle):
1. **হার্ডওয়্যার ডেটা রিডিং:** ESP32 মাইক্রোকন্ট্রোলার প্রতি ৩০ সেকেন্ড পর পর DHT22, PMS5003 এবং MQ135 থেকে সঠিক রিডিং গ্রহণ করে।
2. **HTTP ডেটা ট্রান্সমিশন:** ওয়াই-ফাই নেটওয়ার্কের মাধ্যমে `POST /api/telemetry` এন্ডপয়েন্টে JSON ডেটা পাঠানো হয়।
3. **২-ধাপের মেশিন লার্নিং প্রসেসিং:** ব্যাকএন্ড ডেটা গ্রহণ করে `ColumnTransformer` দিয়ে স্কেলিং করে প্রথমে CatBoost মডেলে পাস করে (Safe vs At-Risk যাচাইয়ের জন্য)। যদি At-Risk হয়, তবে XGBoost মডেল নির্ধারণ করে এটি Yellow (মাঝারি ঝুঁকি) নাকি Red (তীব্র বিপদ)।
4. **TreeSHAP ব্যাখ্যা বিশ্লেষণ:** কোন প্যারামিটারটি কত শতাংশ ঝুঁকি বাড়িয়েছে তা নিখুঁতভাবে গণনা করা হয়।
5. **ক্লাউড ডাটাবেজ সংরক্ষণ:** ফলাফল Supabase PostgreSQL ডাটাবেজে স্টোর হয়।
6. **জরুরি ইমেইল অ্যালার্ট:** ঝুঁকি Red (High Risk) হলে ব্যাকগ্রাউন্ড টাস্কের মাধ্যমে স্বয়ংক্রিয়ভাবে রোগীর ইমেইলে সতর্কবার্তা পাঠানো হয়।
7. **রিয়েল-টাইম ফ্রন্টএন্ড আপডেট:** React ড্যাশবোর্ড ব্যাকএন্ড থেকে প্রতি ৩ সেকেন্ডে সর্বশেষ ডেটা এনে রিয়েল-টাইমে ভিজ্যুয়ালাইজ করে।
8. **ডাক্তারের পরামর্শ সিঙ্ক:** চিকিৎসক জিমেইলে পাঠানো ইমেইলের উত্তর দিলে ব্যাকগ্রাউন্ড IMAP থ্রেড ৬ সেকেন্ড অন্তর নতুন রিপ্লাই চেক করে ডাটাবেজে যুক্ত করে, যা সাথে সাথে রোগীর ড্যাশবোর্ডে ভেসে ওঠে।

---

# 3. IoT Hardware Layer & Sensor Schematics / হার্ডওয়্যার ডিজাইন ও সেন্সর

```
                      +-----------------------------+
                      |        ESP32 DevKit V1      |
                      |                             |
  [DHT22 Data] ------>| GPIO 4  (OneWire Bus)       |
  [PMS5003 TX] ------>| GPIO 16 (UART2 RX)          |
  [PMS5003 RX] <------| GPIO 17 (UART2 TX)          |
  [MQ-135 AOUT] ----->| GPIO 34 (ADC1 Channel 6)    |
  [OLED SDA]   ------>| GPIO 21 (I2C SDA)           |
  [OLED SCL]   ------>| GPIO 22 (I2C SCL)           |
  [Active Buzzer] <---| GPIO 25 (Digital PWM Out)   |
  [Status LED] <------| GPIO 2  (Onboard Indicator) |
                      | 3.3V / 5.0V / GND           |
                      +-----------------------------+
```

### 3.1 হার্ডওয়্যার উপাদানের তালিকা (Bill of Materials - BOM)

| কম্পোনেন্টের নাম | মডেল / স্পেসিফিকেশন | ইন্টারফেস প্রোটোকল | অপারেটিং ভোল্টেজ | মেডিকেল ও ক্লিনিক্যাল গুরুত্ব |
| :--- | :--- | :--- | :--- | :--- |
| **মাইক্রোকন্ট্রোলার** | ESP32 DevKit V1 (30-pin) | Wi-Fi 802.11 b/g/n + BLE | 3.3V - 5.0V | মূল প্রসেসর, ওয়াই-ফাই ট্রান্সমিশন ও এজ কম্পিউটিং |
| **লেজার পার্টিকল কাউন্টার** | Plantower PMS5003 | Hardware UART (9600 baud) | 5.0V VCC, 3.3V Logic | $PM_{1.0}, PM_{2.5}, PM_{10}$ ধূলিকণা গণনা |
| **তাপমাত্রা ও আর্দ্রতা সেন্সর** | Aosong DHT22 (AM2302) | Single-bus Digital (OneWire) | 3.3V - 5.0V | পরিবেশের আর্দ্রতা ($\pm2\%$) ও তাপমাত্রা ($\pm0.5^\circ\text{C}$) পরিমাপ |
| **ক্ষতিকর গ্যাস সেন্সর** | Winsen MQ-135 Air Quality | Analog Output (12-bit ADC) | 5.0V | ক্ষতিকর গ্যাস ($NH_3, NO_x$, ধোঁয়া, $CO_2$) শনাক্তকরণ |
| **লোকাল ডিসপ্লে** | 0.96" I2C Monochrome OLED | I2C (Address 0x3C, 400kHz) | 3.3V | তাৎক্ষণিক ঝুঁকি জোন, AQI ও ওয়াই-ফাই স্ট্যাটাস প্রদর্শন |
| **অডিও অ্যালার্ম** | 5V Active Piezo Buzzer | Digital GPIO Output | 3.3V - 5.0V | Red জোন বা উচ্চ ঝুঁকিতে অ্যালার্ম বাজানো |
| **পাওয়ার ব্যাটারি** | 18650 Li-Ion (2500mAh) + TP4056 | Boost Converter (3.7V -> 5V)| 3.7V Nominal | ১৮ ঘণ্টারও বেশি পোর্টেবল ব্যাকআপ প্রদান |

---

### 3.2 সেন্সরের কার্যপ্রণালী ও গাণিতিক সূত্র (Working Principles):

#### ১. Plantower PMS5003 লেজার সেন্সর:
PMS5003 সেন্সরে একটি ৬৫০ ন্যানোমিটার লেজার ডায়োড এবং ফটোডিটেক্টর থাকে। যখন বাতাসের কণা লেজার রশ্মির মধ্য দিয়ে যায়, তখন আলোর বিচ্ছুরণ ঘটে (Mie Scattering Theory):
$$I(\theta) = I_0 \frac{1 + \cos^2 \theta}{2 r^2} \left( \frac{2\pi}{\lambda} \right)^4 \left( \frac{m^2 - 1}{m^2 + 2} \right)^2 \left( \frac{d}{2} \right)^6$$
মাইক্রোপ্রসেসর এই আলোর পালস গণনা করে প্রতি ঘনমিটারে কণার ভর ($\mu\text{g/m}^3$) রূপান্তর করে। ডেটা প্যাকেটের নির্ভুলতা নিশ্চিত করতে ৩২-বাইটের ফ্রেম চেকসাম ব্যবহার করা হয়:
$$\text{Checksum} = \sum_{k=0}^{29} \text{byte}[k] \equiv (\text{byte}[30] \ll 8) + \text{byte}[31]$$

#### ২. MQ-135 ক্ষতিকর গ্যাস সেন্সর:
MQ-135 সেন্সরে টিন ডাই-অক্সাইড ($\text{SnO}_2$) সেমিকন্ডাক্টর থাকে। বিশুদ্ধ বাতাসে এর প্রতিরোধ ক্ষমতা বেশি থাকে, কিন্তু গ্যাস বা ধোঁয়ার উপস্থিতিতে পৃষ্ঠের প্রতিরোধ কমে যায়:
$$R_s = \left( \frac{V_{in} - V_{out}}{V_{out}} \right) \cdot R_L, \quad \text{PPM} = A \cdot \left( \frac{R_s}{R_0} \right)^B$$
এখানে $R_L$ হলো লোড রেজিস্ট্যান্স এবং $R_0$ হলো বিশুদ্ধ বাতাসে সেন্সরের রেজিস্ট্যান্স।

---

# 4. Dataset Engineering & Ground-Truth Methodology / ডেটাসেট তৈরি ও গবেষণা ভিত্তি

### 4.1 গবেষণা ভিত্তি ও ডেটাসেটের সরাসরি লিংক (Academic Foundations & Direct Links)

RespiGuard সিস্টেমের ডেটাসেটটি আন্তর্জাতিকভাবে স্বীকৃত ক্লিনিক্যাল রিসার্চ এবং আইইইই পেপারের ওপর ভিত্তি করে প্রস্তুত করা হয়েছে:

1. **University of Edinburgh AAMOS-00 Clinical Study Dataset (*Nature Scientific Data 2023*)**
   - **অফিসিয়াল এডিনবরা ডেটাশেয়ার লিংক:** [https://datashare.ed.ac.uk/handle/10283/4761](https://datashare.ed.ac.uk/handle/10283/4761)
   - **DOI / Persistent Identifier:** `10.1038/s41597-023-02100-y` / `DS_10283_4761`
   - **Nature প্রকাশনা জার্নাল লিংক:** [Nature Scientific Data Paper Link](https://www.nature.com/articles/s41597-023-02100-y)
   - **বিবরণ:** এই ক্লিনিক্যাল গবেষণায় স্কটল্যান্ডের একাধিক অঞ্চলের দীর্ঘমেয়াদী অ্যাজমা রোগীদের দৈনিক স্পাইরোমেট্রি ডেটা ($PEF$), ঘণ্টার ভিত্তিতে পরিবেশগত আবহাওয়া ($PM_{2.5}, PM_{10}$, তাপমাত্রা, আর্দ্রতা, বায়ুচাপ) এবং রোগীর বিস্তারিত স্বাস্থ্য তথ্য সংগ্রহ করা হয়েছে।

2. **IEEE Access (2021) "Machine Learning-Based Asthma Risk Prediction Using IoT and Smartphone Applications"**
   - **অফিসিয়াল IEEE Xplore পেপার লিংক:** [https://ieeexplore.ieee.org/document/9380628](https://ieeexplore.ieee.org/document/9380628)
   - **গবেষণার অবদান:** পরিবেশগত তথ্যের ওপর ভিত্তি করে স্ট্যান্ডার্ড পিক এক্সপিরেটরি ফ্লো রেট ($PEFR$) অনুপাতের মাধ্যমে ট্রাই-কালার (Green, Yellow, Red) ক্লাসিফিকেশন ফ্রেমওয়ার্ক প্রতিষ্ঠা করা।

---

### 4.2 Raw Source Data Extraction & Relational Fusion Pipeline

র ডেটাসেটের ৩টি টেবিল `ml_pipeline/build_dataset.py` স্ক্রিপ্টের মাধ্যমে একত্রিত করা হয়:

```
+-------------------------------------------------------------------------------+
| datasets/raw/anonym_aamos00_environment.csv                                   |
| Columns: user_key, date, hour, temperature, humidity, pressure, wind_speed,   |
|          aqi, pm2_5, pm10                                                     |
+---------------------------------------+---------------------------------------+
                                        │ (Inner Join on user_key + date)
+---------------------------------------▼---------------------------------------+
| datasets/raw/anonym_aamos00_peakflow.csv                                      |
| Columns: user_key, date, morning, pef_max, pef_mean, pef_count                |
+---------------------------------------+---------------------------------------+
                                        │ (Left Join on user_key)
+---------------------------------------▼---------------------------------------+
| datasets/raw/anonym_aamos00_patient_info.csv                                  |
| Columns: user_key, sex, age_range, pef_best, max_pef_expected, severity       |
+-------------------------------------------------------------------------------+
```

---

### 4.3 পিক এক্সপিরেটরি ফ্লো রেট ($PEFR$) ও ক্লিনিক্যাল রিস্ক লেবেলিং লজিক

পালমোনোলজি চিকিৎসায় রোগীর ফুসফুসের ক্ষমতা পরিমাপের মূল সূচক হলো **Peak Expiratory Flow Rate (PEFR)**। মেডিকেল অ্যাজমা অ্যাকশন প্ল্যান (Asthma Action Plan - AAP) অনুযায়ী লেবেল নির্ধারণের গাণিতিক ধাপ:

1. **রোগীর ব্যক্তিগত সর্বোচ্চ ফুসফুস ক্ষমতা (Effective Personal Best PEF):**
   $$\text{effective\_pef\_best}_u = \begin{cases} \text{pef\_best}_u & \text{if } \text{pef\_best}_u \text{ is not null} \\ \max_{t} (\text{pef\_max}_{u, t}) & \text{otherwise} \end{cases}$$

2. **PEF অনুপাত গণনা (Ratio Calculation):**
   $$\text{PEF\_Ratio}_{u, t} = \frac{\text{pef\_max}_{u, t}}{\text{effective\_pef\_best}_u}$$

3. **ক্লিনিক্যাল রিস্ক জোন ক্লাসিফিকেশন (3-Zone Triage):**
   $$\text{Risk Label} = \begin{cases} 
   \textbf{Green (Safe / Low Risk)} & \text{if } \text{PEF\_Ratio} \ge 0.80 \quad (80\% - 100\% \text{ Lung Function}) \\
   \textbf{Yellow (Moderate Risk)} & \text{if } 0.50 \le \text{PEF\_Ratio} < 0.80 \quad (50\% - 79\% \text{ Lung Function}) \\
   \textbf{Red (High Risk / Danger Alert)} & \text{if } \text{PEF\_Ratio} < 0.50 \quad (< 50\% \text{ Lung Function - Emergency})
   \end{cases}$$

---

### 4.4 লেজার ফিজিক্স অনুযায়ী $PM_{1.0}$ চ্যানেলের সিন্থেসিস (Laser Aerosol Optics)

প্রচলিত AAMOS-00 ডেটাসেটে $PM_{2.5}$ এবং $PM_{10}$ থাকলেও আধুনিক PMS5003 সেন্সরে ৩টি চ্যানেল ($PM_{1.0}, PM_{2.5}, PM_{10}$) থাকে। বায়ুমণ্ডলীয় অ্যারোসল ফিজিক্সে $PM_{1.0}$ হলো $PM_{2.5}$ এর একটি অতিসূক্ষ্ম ভগ্নাংশ:
$$\frac{PM_{1.0}}{PM_{2.5}} \sim \mathcal{N}(\mu = 0.72, \sigma = 0.03)$$

`build_dataset.py` এ গাণিতিক নরমাল ডিস্ট্রিবিউশন দিয়ে $PM_{1.0}$ ক্যালিব্রেট করা হয়েছে:
$$\alpha_i \sim \mathcal{N}(0.72, 0.03), \quad PM_{1.0, i} = \text{clip}\left(\text{round}(PM_{2.5, i} \cdot \alpha_i, 2), \ 0.1, \ PM_{2.5, i}\right)$$

---

### 4.5 উৎপন্ন ডেটাসেটসমূহ ও ভ্যালিডেশন ইনভেরিয়েন্ট

`python build_dataset.py` রান করলে ৩টি মূল ডেটাসেট তৈরি হয়:
1. **`asthma_risk_dataset.csv` (Primary Core Dataset):** সেন্সর চ্যানেলের পরিচ্ছন্ন ডেটাসেট (`timestamp`, `temperature`, `humidity`, `pm1_0`, `pm2_5`, `pm10`, `risk_label`)।
2. **`asthma_risk_extended.csv` (Extended Cohort Dataset):** রোগীর ব্যক্তিগত প্রোফাইলসহ সম্পূর্ণ ডেটাসেট (`user_key`, `date`, `pef_max`, `effective_pef_best`, `severity`, `age_range`, `sex`, `risk_label`)।
3. **`asthma_risk_daily.csv` (Daily Aggregated Dataset):** দৈনিক গড় হিসেব।

#### ভ্যালিডেশন চেক (`validate_dataset.py`):
- কোনো মিসিং বা নাল ভ্যালু নেই ($0\text{ Nulls}$)।
- আর্দ্রতা কঠোরভাবে $[0\%, 100\%]$ এর মধ্যে সীমাবদ্ধ।
- ধূলিকণার ক্রম $PM_{1.0} \le PM_{2.5} \le PM_{10}$ বজায় রাখা হয়েছে।
- ক্লাসের অনুপাত: **Green: $78.4\%$**, **Yellow: $15.3\%$**, **Red: $6.3\%$**।

---

# 5. Machine Learning Pipeline & Model Architectures / মেশিন লার্নিং মডেল

### 5.1 বেসলাইন মডেলের তুলনামূলক মূল্যায়ন (Baseline Benchmark)

`validate_dataset.py` স্ক্রিপ্টে ৩টি অ্যালগরিদমের ৫-ফোল্ড ক্রস-ভ্যালিডেশন এবং পেশেন্ট-ভিত্তিক গ্রুপ স্প্লিট (GroupKFold on `user_key` - যাতে ডেটা লিকেজ না ঘটে) করা হয়েছে:

| মডেলের নাম | ৫-ফোল্ড স্ট্র্যাটিফাইড নির্ভুলতা | ম্যাক্রো F1-স্কোর | ওয়েটেড F1-স্কোর | হাই-রিস্ক (Red) রিকল |
| :--- | :--- | :--- | :--- | :--- |
| **লজিস্টিক রিগ্রেশন (Standardized)** | $64.82\% \pm 1.84\%$ | $0.4812$ | $0.6654$ | $58.33\%$ |
| **র‍্যান্ডম ফরেস্ট (Balanced Weights)** | $\mathbf{84.60\% \pm 1.15\%}$ | $\mathbf{0.7845}$ | $\mathbf{0.8492}$ | $\mathbf{91.67\%}$ |
| **XGBoost ক্লাসিফায়ার** | $83.90\% \pm 1.42\%$ | $0.7710$ | $0.8410$ | $88.89\%$ |
| **র‍্যান্ডম ফরেস্ট (Patient-Wise GroupKFold)** | $\mathbf{82.35\% \pm 2.40\%}$ | $\mathbf{0.7520}$ | $\mathbf{0.8280}$ | $\mathbf{87.50\%}$ |

---

### 5.2 প্রস্তাবিত ২-ধাপের হায়ারার্কিক্যাল মডেল (2-Stage Hierarchical Architecture)

অ্যাজমা ডেটাসেটে রেড ক্লাস মাত্র ৬% হওয়ায় সাধারণ ক্লাসিফায়ারের তুলনায় ২-ধাপের আর্কিটেকচার অনেক বেশি কার্যকর:

```
[ইনপুট সেন্সর ও রোগীর প্রোফাইল]
                 │
                 ▼
     [ColumnTransformer প্রিপ্রসেসর]
                 │
                 ▼
    [Stage 1: CatBoost Safety Gate]
     ├── Safe (P >= 0.50)  ────────>  🟢 GREEN (নিরাপদ, PEFR >= 80%)
     │
     └── At-Risk (P > 0.50) 
                 │
                 ▼
    [Stage 2: XGBoost Severity Triage]
     ├── Moderate (P < 0.50)  ─────>  🟡 YELLOW (মাঝারি ঝুঁকি, 50% <= PEFR < 80%)
     └── Severe   (P >= 0.50) ─────>  🔴 RED (তীব্র বিপদ, PEFR < 50%)
```

#### গাণিতিক সম্ভাবনা গণনা (Composite Probability):
$$P(\text{Green} \mid \mathbf{x}) = P_{S1}(\text{Safe} \mid \mathbf{x})$$
$$P(\text{Yellow} \mid \mathbf{x}) = P_{S1}(\text{At-Risk} \mid \mathbf{x}) \cdot P_{S2}(\text{Moderate} \mid \mathbf{x})$$
$$P(\text{Red} \mid \mathbf{x}) = P_{S1}(\text{At-Risk} \mid \mathbf{x}) \cdot P_{S2}(\text{Severe} \mid \mathbf{x})$$

#### চূড়ান্ত পারফরম্যান্স (`train_2stage_pipeline.py`):
- **সামগ্রিক নির্ভুলতা (Overall Accuracy):** $\mathbf{87.50\%}$
- **ম্যাক্রো F1-স্কোর:** $\mathbf{0.8124}$
- **উচ্চ ঝুঁকি (Red Class) রিকল:** $\mathbf{93.75\%}$
- মডেল বান্ডেলটি `two_stage_asthma_model.joblib` ফাইলে সংরক্ষিত হয়।

---

# 6. Explainable AI (XAI) & TreeSHAP Attribution Engine / ব্যাখ্যামূলক এআই

### 6.1 গেম-থিওরি ও শ্যাপলি মান (Game-Theoretic TreeSHAP Formula)

RespiGuard কোনো "Black-Box" মডেল নয়। লয়েড শ্যাপলির কো-অপারেটিভ গেম থিওরি অনুযায়ী TreeSHAP প্রতিটি সেন্সরের অবদান গাণিতিকভাবে বের করে:

$$\phi_i(x) = \sum_{S \subseteq F \setminus \{i\}} \frac{|S|!(|F| - |S| - 1)!}{|F|!} \left[ f_x(S \cup \{i\}) - f_x(S) \right]$$

$$\text{Predicted Risk Output} = \phi_0 + \sum_{i=1}^{M} \phi_i(x)$$

### 6.2 গ্লোবাল ফিচার ইমপ্যাক্ট র্যাঙ্কিং (Global Feature Importance):
1. **$PM_{2.5}$ (Fine Particulates):** $34.2\%$ প্রভাব ($\phi = 0.3842$) — ব্রঙ্কিওলের প্রধান প্রদাহ সৃষ্টিকারী।
2. **পরিবেশের তাপমাত্রা (Ambient Temperature):** $25.9\%$ প্রভাব ($\phi = 0.2915$) — হঠাৎ তাপমাত্রা কমে যাওয়া।
3. **আপেক্ষিক আর্দ্রতা (Relative Humidity):** $16.5\%$ প্রভাব ($\phi = 0.1856$) — অ্যালার্জেন ও স্পোর বৃদ্ধি।
4. **$PM_{10}$ (Coarse Dust):** $12.6\%$ প্রভাব ($\phi = 0.1420$) — উপরের শ্বাসনালীর চুলকানি।
5. **$PM_{1.0}$ (Ultrafine Aerosols):** $10.8\%$ প্রভাব ($\phi = 0.1210$) — গভীর অ্যালভিওলাইতে পৌঁছানো।

### 6.3 স্বয়ংক্রিয় ক্লিনিক্যাল পরামর্শ তৈরি (Automated Recommendations):
- **Red জোন:** *"উচ্চ অ্যাজমা ঝুঁকি শনাক্ত হয়েছে! মূল কারণ: বাতাসে PM2.5 এর মাত্রা বিপদজনক (38.4 µg/m³)। অবিলম্বে ঘরের ভেতরে থাকুন, এয়ার ফিল্টার চালু করুন এবং সাথে দ্রুত কার্যকর ইনহেলার (Albuterol) রাখুন।"*
- **Yellow জোন:** *"মাঝারি ঝুঁকি! তাপমাত্রা আকস্মিক হ্রাস পেয়েছে (14.2°C)। বাইরে বের হলে মাস্ক ব্যবহার করুন এবং প্রিভেন্টিভ ইনহেলার সাথে রাখুন।"*
- **Green জোন:** *"পরিবেশ সম্পূর্ণ নিরাপদ। স্বাভাবিক কাজকর্ম চালিয়ে যান।"*

---

# 7. Backend Architecture & Cloud Infrastructure (FastAPI + Supabase)

### 7.1 ব্যাকএন্ড প্রজেক্ট স্ট্রাকচার:
```
backend/
├── main.py              # FastAPI মূল রাউটার এবং লাইফসাইকেল
├── shap_service.py      # ২-ধাপের ML মডেল এবং TreeSHAP ইঞ্জিন
├── db_service.py        # Supabase PostgreSQL ক্লায়েন্ট এবং পাসওয়ার্ড হ্যাশিং
├── email_service.py     # Gmail SMTP (Port 587) OTP এবং অ্যালার্ট ডিসপ্যাচার
├── imap_listener.py     # নন-ব্লকিং ব্যাকগ্রাউন্ড IMAP অটো-সিঙ্ক লিসেনার
└── requirements.txt     # পাইথন ডিপেন্ডেন্সি প্যাকেজ
```

### 7.2 ডাটাবেজ রিলেশনাল ডায়াগ্রাম (ERD):
```
[USER_PROFILES] (id PK, email UK, password_hash, full_name, severity, age, pef_best, created_at)
       │  1
       ├───< N [PATIENT_DOCTORS] (id PK, user_id FK, doctor_name, doctor_email, patient_id_code, created_at)
       │              │ 1
       │              └───< N [DOCTOR_MESSAGES] (id PK, user_id FK, doctor_id FK, sender_type, message_body)
       │  1
       └───< N [TELEMETRY_READINGS] (id PK, user_id FK, device_node, temp, hum, pms, mq135, predicted_risk)
```

### 7.3 প্রধান REST API এন্ডপয়েন্টস:

| মেথড | এন্ডপয়েন্ট | বিবরণ | রিকোয়েস্ট বডি | রেসপন্স সারসংক্ষেপ |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/` | রুট সার্ভিস হেলথ চেক | None | `{"service": "RespiGuard", "status": "online"}` |
| `GET` | `/api/health` | সামগ্রিক মডেল ও ডিবি স্ট্যাটাস | None | `{"status": "healthy", "model": "2-Stage CatBoost+XGBoost"}` |
| `POST` | `/api/auth/send-otp` | জিমেইল SMTP এর মাধ্যমে ৬-সংখ্যার OTP পাঠানো | `{"email", "full_name"}` | `{"success": true, "status": "sent"}` |
| `POST` | `/api/auth/verify-otp` | OTP কোড যাচাইকরণ | `{"email", "otp"}` | `{"success": true, "message": "Email verified"}` |
| `POST` | `/api/auth/signup` | Supabase এ নতুন অ্যাকাউন্ট রেজিস্ট্রেশন | Signup JSON | `{"success": true, "user": {...}}` |
| `POST` | `/api/auth/login` | PBKDF2 হ্যাশ যাচাই করে লগইন | `{"email", "password"}` | `{"success": true, "user": {...}}` |
| `POST` | `/api/telemetry` | ৩০ সেকেন্ডের সেন্সর ডেটা গ্রহণ ও প্রেডিকশন | TelemetryInput JSON | `{"status": "success", "prediction": {...}}` |
| `GET` | `/api/telemetry/latest` | ফ্রন্টএন্ডের জন্য দ্রুত ৩ সেকেন্ডে লাইভ ডেটা | None | `{"telemetry": {...}, "prediction": {...}}` |
| `GET` | `/api/telemetry/history` | অতীতের টাইম-সিরিজ ডেটা | `limit=30` | `{"data": [...], "count": 30}` |
| `POST` | `/api/predict` | একক প্রেডিকশন ও SHAP বিশ্লেষণ | TelemetryInput JSON | সম্পূর্ণ SHAP ওয়াটারফল ও সম্ভাবনা |
| `GET` | `/api/global-importance` | গ্লোবাল TreeSHAP র্যাঙ্কিং | None | `{"importance": [...]}` |
| `GET` | `/api/stats` | নোড ও সামগ্রিক মেট্রিক্স | None | `{"device_status": {...}, "metrics": {...}}` |
| `POST` | `/api/doctors` | ডাক্তারের তথ্য যুক্ত করা (Patient ID সহ) | Doctor Registration JSON | `{"success": true, "doctor": {...}}` |
| `GET` | `/api/doctors` | রোগীর নিবন্ধিত ডাক্তারদের তালিকা | `user_id` query param | `{"doctors": [...]}` |
| `POST` | `/api/messages/send` | ডাক্তারকে ইমেইলসহ মেসেজ পাঠানো | Message JSON | `{"success": true, "email_status": "sent"}` |
| `GET` | `/api/messages` | কনভার্সেশন থ্রেড রিড করা | `user_id`, `doctor_id?` | `{"messages": [...]}` |

---

# 8. Frontend User Interface & Visual Analytics Suite (React + Tailwind CSS)

### 8.1 কালার প্যালেট ও থিম ডিজাইন:
- **Background Dark (`#060f0c`):** গভীর লাক্সারি ব্যাকগ্রাউন্ড।
- **Surface Glass (`#0a1713`):** ফ্রস্টেড গ্লাস এফেক্ট কার্ড।
- **Emerald Neon (`#00e599`):** অ্যাকসেন্ট ও সেফ জোন ইন্ডিকেটর।
- **Warning Amber (`#f59e0b`):** মাঝারি ঝুঁকি।
- **Danger Red (`#ef4444`):** উচ্চ বিপদ ও অ্যালার্ট।

### 8.2 ফ্রন্টএন্ডের প্রধান কম্পোনেন্টসমূহ:
1. **`HeroBanner.jsx`:** ৩D মেডিকেল অবতার, লাইভ স্ট্যাটাস পিল, তাপমাত্রা ও আর্দ্রতার ব্যাজ।
2. **`AirQualityRadial.jsx`:** ৩-স্তরের কনসেন্ট্রিক সার্কুলার গেজ ($PM_{2.5}, PM_{10}$, আর্দ্রতা)।
3. **`WaveTrendChart.jsx`:** গ্লোয়িং পালস ওয়েভফর্ম চার্ট।
4. **`AdherenceChart.jsx`:** ইনহেলার ডোজ ও পরিবেশগত নিয়মানুবর্তিতা চার্ট।
5. **`ShapFeatureImportance.jsx`:** প্রতিটি সেন্সরের অবদান দেখানোর জন্য অনুভূমিক ক্যাপসুল বার চার্ট।
6. **`TelemetrySimulator.jsx`:** ইন্টারঅ্যাক্টিভ স্লাইডার ও প্রিসেট বাটন (Clean Air, High Humidity, Pollution Spike)।
7. **`MessagesPage.jsx`:** জিমেইল সিঙ্ক স্ট্যাটাসসহ চিকিৎসকের সাথে সরাসরি চ্যাট পোর্টাল।

---

# 9. IoT Telemetry Simulator (`sensor_simulator.py`)

`sensor_simulator.py` বাস্তব সেন্সরের অনুকরণে ব্রাউনিয়ান মোশন এবং গড় প্রত্যাবর্তনের পদার্থবিজ্ঞান মডেলে ডেটা তৈরি করে:
$$X_{t+1} = X_t + \underbrace{\mathcal{N}(0, \sigma^2)}_{\text{Brownian Drift}} + \underbrace{\kappa (\mu - X_t)}_{\text{Mean Reversion Pull}}$$

- **চালানোর কমান্ড:**
```bash
# সাধারণ মোড (প্রতি ৩০ সেকেন্ডে ডেটা পাঠায়)
python sensor_simulator.py

# দ্রুত টেস্ট মোড (প্রতি ১০ সেকেন্ডে ডেটা পাঠায়)
python sensor_simulator.py --interval 10

# উচ্চ দূষণ স্পাইক সিমুলেশন মোড
python sensor_simulator.py --interval 10 --spike
```

---

# 10. Comprehensive Setup, Installation & Execution Guide / ব্যবহারের নিয়মাবলী

### ধাপ ১: পাইথন ডিপেন্ডেন্সি ইনস্টলেশন
```bash
pip install -r backend/requirements.txt
```

### ধাপ ২: ডেটাসেট তৈরি ও মেশিন লার্নিং মডেল ট্রেইনিং
```bash
python build_dataset.py
python validate_dataset.py
python train_2stage_pipeline.py
```

### ধাপ ৩: FastAPI ব্যাকএন্ড সার্ভার চালু করা
```bash
python run_backend.py
```
- ব্যাকএন্ড সার্ভার: `http://127.0.0.1:8000`
- সোয়াগার ডক্স: `http://127.0.0.1:8000/docs`

### ধাপ ৪: React ফ্রন্টএন্ড ড্যাশবোর্ড চালু করা
```bash
cd frontend
npm install
npm run dev
```
- ফ্রন্টএন্ড ড্যাশবোর্ড: `http://localhost:5173`

### ধাপ ৫: সেন্সর সিমুলেটর চালু করা
```bash
python sensor_simulator.py --interval 10 --spike
```

*(উইন্ডোজ ব্যবহারকারীরা সরাসরি `run_backend.bat` এবং `run_frontend.bat` ফাইলে ডাবল-ক্লিক করেও চালু করতে পারেন)*

---

# 11. Troubleshooting & Common Failure Modes / ত্রুটি ও সমাধান

1. **Gmail Authentication Error (535 Password not accepted):**
   - সাধারণ জিমেইল পাসওয়ার্ড কাজ করবে না। গুগল অ্যাকাউন্টে **2-Step Verification** অন করে [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) থেকে ১৬ অক্ষরের **App Password** তৈরি করে `.env` এর `SMTP_PASSWORD` এ বসাতে হবে।
2. **Frontend Offline Indicator:**
   - নিশ্চিত করুন ব্যাকএন্ড `http://127.0.0.1:8000` এ সচল রয়েছে।
3. **Missing ML Model:**
   - `python ml_pipeline/train_2stage_pipeline.py` চালিয়ে `models/two_stage_asthma_model.joblib` ফাইল তৈরি করুন।

---

# 12. Future Roadmap & Developer Continuation Guide / ভবিষ্যৎ উন্নয়ন পরিকল্পনা

প্রকল্পে পরবর্তীতে নতুন ফিচার যুক্ত করার জন্য রোডম্যাপ:

1. **TinyML on ESP32 Microcontroller (Edge AI):**
   - CatBoost বা Random Forest মডেলটিকে **Edge Impulse** বা **TensorFlow Lite for Microcontrollers (TFLM)** এর মাধ্যমে সরাসরি ESP32 চিপে ফ্ল্যাশ করা, যাতে ইন্টারনেট সংযোগ ছাড়াই ডিভাইস তাৎক্ষণিক বিপদের সাইরেন বাজাতে পারে।
2. **Cross-Platform Mobile App (Flutter / React Native):**
   - ব্লুটুথ লো এনার্জি (BLE) এর মাধ্যমে মোবাইলের সাথে পেয়ার করা এবং ব্যাকগ্রাউন্ড জিওফেন্সিংয়ের মাধ্যমে দূষিত এলাকায় ঢুকলে সতর্কবার্তা পাঠানো।
3. **Smart Inhaler Add-on:**
   - রোগীর ইনহেলারে অ্যাকোস্টিক বা ক্যাপাসিটিভ সুইচ যুক্ত করে স্বয়ংক্রিয়ভাবে ডোজ কাউন্ট ক্লাউডে সংরক্ষণ করা।
4. **Hospital EHR Interoperability (HL7 / FHIR Standard):**
   - জরুরি অ্যালার্টগুলোকে হাসপাতালের ইলেকট্রনিক হেলথ রেকর্ড সিস্টেমে স্বয়ংক্রিয়ভাবে রপ্তানি করা।

---

## 👨‍💻 Maintainer & Academic Citation

```bibtex
@misc{respiguard2026,
  author = {Shihab Sarker and RespiGuard Research Team},
  title = {RespiGuard (AuraBreath AI): Explainable AI-Powered Real-Time Portable Asthma Exacerbation Risk Prediction System},
  year = {2026},
  howpublished = {Department of Computer Science & Engineering, 3-2 Semester Embedded Systems Project}
}
```
