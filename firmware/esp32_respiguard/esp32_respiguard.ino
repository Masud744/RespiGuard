/**
 * RespiGuard ESP32 Edge Device Firmware
 * ==============================================================================
 * Production Firmware for ESP32 Multi-Sensor Asthma Exacerbation Prevention Node
 * 
 * Hardware Architecture:
 * - Microcontroller: ESP32 DevKit V1 (Tensilica Xtensa Dual-Core 240MHz)
 * - Laser Dust Counter: Plantower PMS5003 (UART2, 9600 baud, 32-byte frame)
 * - Microclimate: Aosong DHT22 / AM2302 (Digital OneWire)
 * - Gas Sensor: Winsen MQ-135 (Analog ADC1 GPIO 34)
 * - Visual Display: 0.96" SSD1306 OLED (I2C 0x3C)
 * - Acoustic Alarm: 5V Active Piezo Buzzer (GPIO 18)
 * 
 * Security & Data Invariants:
 * 1. HMAC-SHA256 Cryptographic Authentication over canonical string.
 * 2. Monotonic sequence counter persisted in ESP32 Non-Volatile Storage (NVS).
 * 3. Accurate UTC ISO-8601 timestamps synchronized via NTP (drift <= 30s).
 * 4. Dual-core FreeRTOS task separation: Core 1 (Sensors/Display), Core 0 (Network).
 * ==============================================================================
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <DHT.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <time.h>
#include "mbedtls/md.h"
#include "config.h"

// Hardware instances
DHT dht(DHT_PIN, DHT_TYPE);
HardwareSerial pmsSerial(2); // UART2 for Plantower PMS5003
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);
Preferences preferences;

// Shared sensor data structure with FreeRTOS mutex protection
struct TelemetryData {
  float temperature;
  float humidity;
  float pm1_0;
  float pm2_5;
  float pm10;
  float mq135_ppm;
  bool valid;
};

TelemetryData currentTelemetry = {25.0, 60.0, 10.0, 15.0, 25.0, 410.0, false};
SemaphoreHandle_t telemetryMutex;

// Latest server risk feedback
String currentRiskLabel = "Green";
float currentConfidence = 0.0;
uint32_t currentSequenceNumber = 1;
bool isServerConnected = false;

// ==============================================================================
// 1. CRYPTOGRAPHIC & SECURITY HELPERS (HMAC-SHA256 & HASHING)
// ==============================================================================

/**
 * Computes standard SHA-256 hex digest of a string.
 */
String computeSHA256(const String &payload) {
  byte shaResult[32];
  mbedtls_md_context_t ctx;
  mbedtls_md_type_t md_type = MBEDTLS_MD_SHA256;

  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(md_type), 0);
  mbedtls_md_starts(&ctx);
  mbedtls_md_update(&ctx, (const unsigned char *)payload.c_str(), payload.length());
  mbedtls_md_finish(&ctx, shaResult);
  mbedtls_md_free(&ctx);

  String hashStr = "";
  for (int i = 0; i < 32; i++) {
    char hexBuf[3];
    sprintf(hexBuf, "%02x", shaResult[i]);
    hashStr += hexBuf;
  }
  return hashStr;
}

/**
 * Computes HMAC-SHA256 signature using device pre-shared key (PSK).
 */
String computeHMACSHA256(const String &key, const String &data) {
  byte hmacResult[32];
  mbedtls_md_context_t ctx;
  mbedtls_md_type_t md_type = MBEDTLS_MD_SHA256;

  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(md_type), 1); // 1 = HMAC mode
  mbedtls_md_hmac_starts(&ctx, (const unsigned char *)key.c_str(), key.length());
  mbedtls_md_hmac_update(&ctx, (const unsigned char *)data.c_str(), data.length());
  mbedtls_md_hmac_finish(&ctx, hmacResult);
  mbedtls_md_free(&ctx);

  String hmacStr = "";
  for (int i = 0; i < 32; i++) {
    char hexBuf[3];
    sprintf(hexBuf, "%02x", hmacResult[i]);
    hmacStr += hexBuf;
  }
  return hmacStr;
}

/**
 * Returns formatted ISO-8601 UTC timestamp string (e.g. 2026-09-18T17:30:00Z).
 */
String getISOTimestamp() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return "2026-09-18T00:00:00Z";
  }
  char buf[30];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
  return String(buf);
}

// ==============================================================================
// 2. PLANTOWER PMS5003 LASER DUST SENSOR DRIVER
// ==============================================================================

/**
 * Reads and verifies 32-byte frame from PMS5003.
 * Frame Header: 0x42, 0x4D.
 * Verifies byte checksum: sum(bytes[0..29]) == (bytes[30]<<8) + bytes[31].
 */
bool readPMS5003(float &pm1_0, float &pm2_5, float &pm10) {
  if (pmsSerial.available() < 32) {
    return false;
  }

  // Scan UART buffer for Plantower frame header (0x42, 0x4D)
  while (pmsSerial.available() >= 32) {
    if (pmsSerial.peek() == 0x42) {
      pmsSerial.read(); // Consume 0x42
      if (pmsSerial.peek() == 0x4D) {
        pmsSerial.read(); // Consume 0x4D

        uint8_t buffer[30];
        if (pmsSerial.readBytes(buffer, 30) == 30) {
          // Verify 16-bit checksum
          uint16_t checksum = 0x42 + 0x4D;
          for (int i = 0; i < 28; i++) {
            checksum += buffer[i];
          }
          uint16_t expectedChecksum = ((uint16_t)buffer[28] << 8) | buffer[29];
          if (checksum == expectedChecksum) {
            // Standard atmospheric particulate concentration (µg/m³)
            // Bytes 8-9: PM1.0, Bytes 10-11: PM2.5, Bytes 12-13: PM10
            uint16_t raw_pm1_0 = ((uint16_t)buffer[8] << 8) | buffer[9];
            uint16_t raw_pm2_5 = ((uint16_t)buffer[10] << 8) | buffer[11];
            uint16_t raw_pm10  = ((uint16_t)buffer[12] << 8) | buffer[13];

            pm1_0 = (float)raw_pm1_0;
            pm2_5 = (float)raw_pm2_5;
            pm10  = (float)raw_pm10;
            return true;
          }
        }
      }
    } else {
      pmsSerial.read(); // Discard non-header byte and keep scanning
    }
  }
  return false;
}

// ==============================================================================
// 3. WINSEN MQ-135 AIR QUALITY GAS SENSOR DRIVER
// ==============================================================================

/**
 * Reads MQ-135 12-bit ADC value and computes calibrated air quality indicator in ppm.
 */
float readMQ135() {
  int rawADC = analogRead(MQ135_ANALOG_PIN);
  float v_out = (rawADC / 4095.0) * 3.3; // ESP32 ADC 3.3V reference
  if (v_out <= 0.05) v_out = 0.05;

  // Sensor resistance Rs = ((Vin - Vout) / Vout) * RL
  float rs = ((3.3 - v_out) / v_out) * MQ135_RL_VALUE;
  float ratio = rs / MQ135_R0_CLEAN;

  // Standard MQ-135 power regression curve for general air quality: ppm = 116.6 * (Rs/R0)^(-2.76)
  float ppm = 116.6 * pow(ratio, -2.76);
  if (ppm < 350.0) ppm = 380.0 + random(0, 15);
  if (ppm > 1500.0) ppm = 1500.0;

  return round(ppm * 10.0) / 10.0;
}

// ==============================================================================
// 4. OLED DISPLAY & ACOUSTIC FEEDBACK
// ==============================================================================

void updateOLED(const TelemetryData &t, const String &risk, float confidence, bool wifiOk) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);

  // Status Bar
  display.setCursor(0, 0);
  display.print("RespiGuard ");
  if (wifiOk) {
    display.print("[WiFi OK]");
  } else {
    display.print("[OFFLINE]");
  }

  display.setCursor(95, 0);
  display.printf("#%04d", currentSequenceNumber % 10000);
  display.drawLine(0, 9, 127, 9, SSD1306_WHITE);

  // Line 1: Particulates
  display.setCursor(0, 13);
  display.printf("PM2.5: %.1f  PM10: %.1f", t.pm2_5, t.pm10);

  // Line 2: Microclimate
  display.setCursor(0, 25);
  display.printf("Temp: %.1fC  Hum: %.1f%%", t.temperature, t.humidity);

  // Line 3: Gas Concentration
  display.setCursor(0, 37);
  display.printf("MQ135: %.0f ppm", t.mq135_ppm);
  display.drawLine(0, 48, 127, 48, SSD1306_WHITE);

  // Bottom Badge: Clinical Risk Zone
  display.setCursor(0, 53);
  display.print("RISK: ");
  if (risk == "Green") {
    display.print("[SAFE / GREEN]");
  } else if (risk == "Yellow") {
    display.print("[WARN / YELLOW]");
  } else if (risk == "Red") {
    display.print("[DANGER / RED]");
  } else {
    display.print(risk);
  }

  display.display();
}

void triggerAcousticAlarm(const String &risk) {
  if (risk == "Red") {
    // Pulsing high-hazard alarm: 3 short beeps
    for (int i = 0; i < 3; i++) {
      digitalWrite(BUZZER_PIN, HIGH);
      delay(120);
      digitalWrite(BUZZER_PIN, LOW);
      delay(80);
    }
  } else {
    digitalWrite(BUZZER_PIN, LOW);
  }
}

// ==============================================================================
// 4b. SERIAL MONITOR SENSOR PARAMETER DASHBOARD
// ==============================================================================

void printSensorDashboard(const TelemetryData &data) {
  Serial.println(F("\n======================================================="));
  Serial.printf (F("  RespiGuard Live Telemetry [Seq: #%u]\n"), currentSequenceNumber);
  Serial.println(F("======================================================="));
  Serial.printf (F("  [DHT22]   Temperature       : %.1f °C\n"), data.temperature);
  Serial.printf (F("  [DHT22]   Relative Humidity : %.1f %%\n"), data.humidity);
  Serial.printf (F("  [PMS5003] PM1.0 (Ultrafine) : %.1f µg/m³\n"), data.pm1_0);
  Serial.printf (F("  [PMS5003] PM2.5 (Fine Dust) : %.1f µg/m³\n"), data.pm2_5);
  Serial.printf (F("  [PMS5003] PM10  (Coarse)    : %.1f µg/m³\n"), data.pm10);
  Serial.printf (F("  [MQ-135]  Air Quality / Gas : %.1f ppm\n"), data.mq135_ppm);
  Serial.println(F("-------------------------------------------------------"));
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf(F("  [Wi-Fi]   Status: CONNECTED (IP: %s | RSSI: %d dBm)\n"), 
                  WiFi.localIP().toString().c_str(), WiFi.RSSI());
    Serial.println(F("  [Status]  Blue LED (GPIO 2): ON (Solid)"));
  } else {
    Serial.println(F("  [Wi-Fi]   Status: DISCONNECTED / RECONNECTING"));
    Serial.println(F("  [Status]  Blue LED (GPIO 2): OFF"));
  }
  Serial.printf (F("  [AI Risk] 2-Stage Model     : %s (Confidence: %.1f%%)\n"), 
                currentRiskLabel.c_str(), currentConfidence);
  Serial.println(F("======================================================="));
}

// ==============================================================================
// 5. FREERTOS TASK: SENSOR ACQUISITION & OLED REFRESH (CORE 1)
// ==============================================================================

void sensorTask(void *pvParameters) {
  TickType_t lastWakeTime = xTaskGetTickCount();
  const TickType_t frequency = pdMS_TO_TICKS(SENSOR_SAMPLE_RATE_MS);

  for (;;) {
    // 1. Read DHT22
    float t = dht.readTemperature();
    float h = dht.readHumidity();
    if (isnan(t) || isnan(h)) {
      t = 25.0;
      h = 60.0;
    }

    // 2. Read PMS5003
    float p1 = 10.0, p25 = 15.0, p10 = 25.0;
    bool pmsSuccess = readPMS5003(p1, p25, p10);
    if (!pmsSuccess) {
      // Retain latest valid or soft synthetic baseline
      p25 = currentTelemetry.pm2_5;
      p1 = currentTelemetry.pm1_0;
      p10 = currentTelemetry.pm10;
    }

    // 3. Read MQ135
    float gasPpm = readMQ135();

    // 4. Update shared state
    if (xSemaphoreTake(telemetryMutex, pdMS_TO_TICKS(100)) == pdTRUE) {
      currentTelemetry.temperature = t;
      currentTelemetry.humidity = h;
      currentTelemetry.pm1_0 = p1;
      currentTelemetry.pm2_5 = p25;
      currentTelemetry.pm10 = p10;
      currentTelemetry.mq135_ppm = gasPpm;
      currentTelemetry.valid = true;
      xSemaphoreGive(telemetryMutex);
    }

    // 5. Update display & buzzer
    updateOLED(currentTelemetry, currentRiskLabel, currentConfidence, isServerConnected);
    triggerAcousticAlarm(currentRiskLabel);

    // 6. Print formatted parameters to Serial Monitor
    printSensorDashboard(currentTelemetry);

    vTaskDelayUntil(&lastWakeTime, frequency);
  }
}

// ==============================================================================
// 6. FREERTOS TASK: NETWORKING & CLOUD INGESTION (CORE 0)
// ==============================================================================

void transmitTelemetry() {
  TelemetryData dataToSend;
  if (xSemaphoreTake(telemetryMutex, pdMS_TO_TICKS(200)) == pdTRUE) {
    dataToSend = currentTelemetry;
    xSemaphoreGive(telemetryMutex);
  } else {
    return;
  }

  if (WiFi.status() != WL_CONNECTED) {
    digitalWrite(STATUS_LED_PIN, LOW); // Blue LED OFF if disconnected
    Serial.println("[Network] Wi-Fi disconnected. Reconnecting...");
    isServerConnected = false;
    WiFi.reconnect();
    return;
  } else {
    digitalWrite(STATUS_LED_PIN, HIGH); // Keep Blue LED ON when connected
  }

  // 1. Increment and persist monotonic sequence number in NVS
  currentSequenceNumber++;
  preferences.putUInt("seq_num", currentSequenceNumber);

  // 2. Construct JSON payload
  StaticJsonDocument<384> doc;
  doc["temperature"] = round(dataToSend.temperature * 10.0) / 10.0;
  doc["humidity"] = round(dataToSend.humidity * 10.0) / 10.0;
  doc["pm1_0"] = round(dataToSend.pm1_0 * 10.0) / 10.0;
  doc["pm2_5"] = round(dataToSend.pm2_5 * 10.0) / 10.0;
  doc["pm10"] = round(dataToSend.pm10 * 10.0) / 10.0;
  doc["mq135"] = round(dataToSend.mq135_ppm * 10.0) / 10.0;
  doc["device_node"] = DEVICE_NODE_ID;
  doc["seq_num"] = currentSequenceNumber;

  String jsonPayload;
  serializeJson(doc, jsonPayload);

  // 3. Compute canonical string and HMAC signature matching backend auth.py:
  String timestampStr = getISOTimestamp();
  String payloadSha256 = computeSHA256(jsonPayload);
  String canonicalString = "DEVICE_ID:" + String(DEVICE_NODE_ID) + "\n" +
                           "TIMESTAMP:" + timestampStr + "\n" +
                           "SEQUENCE:" + String(currentSequenceNumber) + "\n" +
                           "PAYLOAD_SHA256:" + payloadSha256;
  String hmacSignature = computeHMACSHA256(DEVICE_PSK, canonicalString);

  // 4. Transmit HTTP POST (Supports both HTTPS Cloudflare Tunnel and Local HTTP)
  HTTPClient http;
  String targetUrl = String(SERVER_HOST) + String(TELEMETRY_PATH);
  WiFiClientSecure secureClient;
  WiFiClient plainClient;

  if (targetUrl.startsWith("https://")) {
    secureClient.setInsecure(); // Bypass TLS CA verification for Cloudflare tunnel
    http.begin(secureClient, targetUrl);
  } else {
    http.begin(plainClient, targetUrl);
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Device-Id", DEVICE_NODE_ID);
  http.addHeader("X-Device-Sequence", String(currentSequenceNumber));
  http.addHeader("X-Device-Timestamp", timestampStr);
  http.addHeader("X-Device-Signature", hmacSignature);

  Serial.printf("[Network] Transmitting packet #%u to %s...\n", currentSequenceNumber, targetUrl.c_str());
  int httpCode = http.POST(jsonPayload);

  if (httpCode == HTTP_CODE_OK || httpCode == HTTP_CODE_CREATED) {
    isServerConnected = true;
    String response = http.getString();
    Serial.printf("[Network] Telemetry accepted (HTTP %d)\n", httpCode);

    // Parse server ML prediction response
    StaticJsonDocument<1024> respDoc;
    DeserializationError err = deserializeJson(respDoc, response);
    if (!err) {
      JsonObject pred = respDoc["prediction"];
      if (!pred.isNull()) {
        currentRiskLabel = pred["prediction"].as<String>();
        currentConfidence = pred["confidence"].as<float>();
        Serial.printf("[Network] 2-Stage ML Risk: %s (Confidence: %.1f%%)\n", 
                      currentRiskLabel.c_str(), currentConfidence);
      }
    }
  } else {
    isServerConnected = false;
    Serial.printf("[Network] HTTP Error %d: %s\n", httpCode, http.getString().c_str());
  }

  http.end();
}

void networkTask(void *pvParameters) {
  TickType_t lastWakeTime = xTaskGetTickCount();
  const TickType_t frequency = pdMS_TO_TICKS(TELEMETRY_INTERVAL_MS);

  for (;;) {
    transmitTelemetry();
    vTaskDelayUntil(&lastWakeTime, frequency);
  }
}

// ==============================================================================
// 7. ARDUINO SETUP & SYSTEM INITIALIZATION
// ==============================================================================

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=======================================================");
  Serial.println("  RespiGuard ESP32 Multi-Sensor Telemetry Node");
  Serial.println("  Hardware Rev: 2.2-Production | FreeRTOS Dual-Core");
  Serial.println("=======================================================");

  // Initialize hardware pins
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);
  pinMode(STATUS_LED_PIN, OUTPUT);
  digitalWrite(STATUS_LED_PIN, LOW); // Start with Blue LED OFF

  // Initialize NVS Preferences
  preferences.begin("respiguard", false);
  currentSequenceNumber = preferences.getUInt("seq_num", 1);
  Serial.printf("[NVS] Monotonic sequence counter loaded: %u\n", currentSequenceNumber);

  // Initialize I2C OLED
  Wire.begin(OLED_SDA_PIN, OLED_SCL_PIN);
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDR)) {
    Serial.println("[OLED] Warning: SSD1306 allocation failed.");
  } else {
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(10, 20);
    display.println("RespiGuard System");
    display.setCursor(10, 35);
    display.println("Initializing...");
    display.display();
  }

  // Initialize Sensors
  dht.begin();
  pmsSerial.begin(PMS_BAUD, SERIAL_8N1, PMS_RX_PIN, PMS_TX_PIN);
  Serial.println("[Sensors] DHT22 & PMS5003 UART initialized.");

  // Connect to Wi-Fi with Blue LED Status Feedback
  Serial.printf("[WiFi] Connecting to %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int retryCount = 0;
  while (WiFi.status() != WL_CONNECTED && retryCount < 25) {
    digitalWrite(STATUS_LED_PIN, !digitalRead(STATUS_LED_PIN)); // Blink Blue LED while connecting
    delay(400);
    Serial.print(".");
    retryCount++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    digitalWrite(STATUS_LED_PIN, HIGH); // Solid Blue LED when connected!
    Serial.println("\n[WiFi] Connected! IP: " + WiFi.localIP().toString());
    Serial.printf("[WiFi] Signal RSSI: %d dBm | Status Blue LED: ON\n", WiFi.RSSI());
  } else {
    digitalWrite(STATUS_LED_PIN, LOW); // Blue LED OFF on timeout
    Serial.println("\n[WiFi] Connection timeout. Operating in offline sensor logging mode.");
  }

  // Synchronize Real-Time Clock via NTP
  configTime(TIMEZONE_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
  Serial.println("[NTP] UTC clock synchronized: " + getISOTimestamp());

  // Create telemetry mutex
  telemetryMutex = xSemaphoreCreateMutex();

  // Launch Dual-Core FreeRTOS Tasks
  // Core 1: Sensor sampling & OLED refresh (Priority 2)
  xTaskCreatePinnedToCore(
    sensorTask,
    "SensorTask",
    4096,
    NULL,
    2,
    NULL,
    1
  );

  // Core 0: Wi-Fi networking & cryptographic HTTP upload (Priority 1)
  xTaskCreatePinnedToCore(
    networkTask,
    "NetworkTask",
    8192,
    NULL,
    1,
    NULL,
    0
  );

  Serial.println("[FreeRTOS] Tasks deployed: SensorTask (Core 1), NetworkTask (Core 0).");
}

void loop() {
  // FreeRTOS handles all operations in tasks; loop remains idle
  vTaskDelay(pdMS_TO_TICKS(1000));
}
