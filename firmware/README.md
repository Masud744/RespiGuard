# RespiGuard ESP32 Edge Device Firmware
**Revision:** 2.2-Production | **Platform:** ESP32 DevKit V1 (Tensilica Xtensa Dual-Core 240MHz)

---

## 1. Hardware Pinout & Wiring Connections

| Component | Pin on Sensor | ESP32 Pin | Logic Level | Operating Notes |
| :--- | :--- | :--- | :---: | :--- |
| **DHT22 / AM2302** | VCC | `5V / 3.3V` | 3.3V | Microclimate temperature & humidity |
| | GND | `GND` | — | Ground bus |
| | DATA | `GPIO 4` | 3.3V | Single-bus digital signal with 10k pull-up |
| **Plantower PMS5003** | VCC (Pin 1) | `5.0V` | 5.0V | Required for internal fan and laser diode |
| | GND (Pin 2) | `GND` | — | Common system ground |
| | TXD (Pin 5) | `GPIO 16 (RX2)` | 3.3V | 9600 baud, 8N1 serial data stream |
| | RXD (Pin 4) | `GPIO 17 (TX2)` | 3.3V | Optional sleep/standby control |
| **Winsen MQ-135** | VCC | `5.0V` | 5.0V | Required for tin dioxide ($SnO_2$) heating coil |
| | GND | `GND` | — | Common ground |
| | AOUT | `GPIO 34 (ADC1)`| 0 - 3.3V | Must use ADC1 (ADC2 conflicts with Wi-Fi) |
| **SSD1306 0.96" OLED**| VCC | `3.3V` | 3.3V | Monochrome 128x64 visual display |
| | GND | `GND` | — | Ground |
| | SCL | `GPIO 22 (SCL)`| 3.3V | I2C clock (400 kHz) |
| | SDA | `GPIO 21 (SDA)`| 3.3V | I2C data (Address: `0x3C`) |
| **Piezo Buzzer** | Positive (+) | `GPIO 18` | 3.3V | Active buzzer (switches on Red zone hazard) |
| | Negative (-) | `GND` | — | Ground |
| **Status Blue LED** | Onboard LED | `GPIO 2` | 3.3V | Blinks when connecting, Solid ON when Wi-Fi connected, OFF when offline |


---

## 2. Required Arduino IDE / PlatformIO Libraries

Install the following libraries via Arduino Library Manager or `platformio.ini`:
1. `Adafruit SSD1306` (by Adafruit)
2. `Adafruit GFX Library` (by Adafruit)
3. `DHT sensor library` (by Adafruit)
4. `ArduinoJson` (v6.21.0 or higher by Benoit Blanchon)
5. `WiFiClientSecure` & `HTTPClient` (bundled with ESP32 Arduino Core)

---

## 3. Configuration & Flashing

1. Open `firmware/config.h`.
2. Configure your Wi-Fi credentials:
   ```cpp
   #define WIFI_SSID     "Your_WiFi_Network"
   #define WIFI_PASSWORD "Your_WiFi_Password"
   ```
3. Set your server IP address (e.g. your local computer running FastAPI):
   ```cpp
   #define SERVER_HOST   "http://192.168.1.50:8000"
   ```
4. Verify the pre-shared key `DEVICE_PSK` matches `SIMULATOR_DEVICE_PSK` in backend `.env`.
5. Connect ESP32 via Micro-USB, select board **"ESP32 Dev Module"**, and upload!

---

## 4. FreeRTOS Dual-Core Task Execution
- **Core 1 (`SensorTask`):** Samples PMS5003 laser particles, DHT22 microclimate, and MQ-135 gas every 2 seconds, while updating the OLED display and sounding the piezo buzzer.
- **Core 0 (`NetworkTask`):** Computes HMAC-SHA256 signatures, manages monotonic sequence numbers in NVS, and transmits encrypted packets every 30 seconds to `/api/telemetry`.
