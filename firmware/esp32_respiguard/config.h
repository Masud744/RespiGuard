#ifndef RESPI_CONFIG_H
#define RESPI_CONFIG_H

// ==============================================================================
// RespiGuard ESP32 Edge Device Configuration
// Hardware Revision: Rev 2.2-Production
// ==============================================================================

// 1. Wi-Fi Credentials
#define WIFI_SSID         "Masud"
#define WIFI_PASSWORD     "password"

// 2. RespiGuard Backend Server Configuration (Production Render Cloud)
// Allows ESP32 to push telemetry from ANY Wi-Fi / Hotspot globally!
#define SERVER_HOST       "https://respiguard-backend.onrender.com"
#define TELEMETRY_PATH    "/api/telemetry"
#define DEVICE_NODE_ID    "ESP32-RespiGuard-01"

// 3. Cryptographic Pre-Shared Key (PSK)
// Must match the secret in backend .env (SIMULATOR_DEVICE_PSK or database device_secrets)
#define DEVICE_PSK        "respiguard-device-psk-secret-key-2026"

// 4. Hardware Pin Mappings
// Built-in Blue Status LED (GPIO 2 on ESP32 DevKit V1)
#define STATUS_LED_PIN    2

// DHT22 Temperature & Humidity (Single Bus Digital)
#define DHT_PIN           4
#define DHT_TYPE          DHT22

// Plantower PMS5003 Laser Dust Counter (Hardware UART2)
#define PMS_RX_PIN        16   // Connect to PMS5003 TX
#define PMS_TX_PIN        17   // Connect to PMS5003 RX (Optional, for standby control)
#define PMS_BAUD          9600

// Winsen MQ-135 Gas Sensor (Analog ADC1)
// Note: Use ADC1 pins (GPIO 32-39) because ADC2 is shared with Wi-Fi
#define MQ135_ANALOG_PIN  34
#define MQ135_RL_VALUE    10.0 // Load resistance on breakout module (10k ohms)
#define MQ135_R0_CLEAN    76.6 // Clean air calibration resistance (in k ohms)

// Visual OLED Display (SSD1306 I2C 128x64)
#define OLED_SDA_PIN      21
#define OLED_SCL_PIN      22
#define OLED_I2C_ADDR     0x3C
#define SCREEN_WIDTH      128
#define SCREEN_HEIGHT     64

// Acoustic Alarm (Active Piezo Buzzer)
#define BUZZER_PIN        18

// 5. Operational Cadence & Timers
#define TELEMETRY_INTERVAL_MS   30000   // 30 seconds standard medical sampling interval
#define SENSOR_SAMPLE_RATE_MS   2000    // Sensor local sampling rate (2s)
#define NTP_SERVER              "pool.ntp.org"
#define TIMEZONE_OFFSET_SEC     0       // UTC offset (0 for strict UTC timestamps)
#define DAYLIGHT_OFFSET_SEC     0

#endif // RESPI_CONFIG_H
