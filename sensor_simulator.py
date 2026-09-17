"""
RespiGuard IoT Sensor Telemetry Simulator
=========================================
Imitates real physical hardware (ESP32 + DHT22 + PMS5003 + MQ135)
Generates natural fluctuating sensor values and sends them to the backend
every 30 seconds (or custom interval).

Usage:
  python sensor_simulator.py
  python sensor_simulator.py --interval 10
  python sensor_simulator.py --spike  # Simulates an occasional pollution spike
"""

import time
import random
import argparse
import requests
from datetime import datetime

# ANSI Color Codes for terminal
RESET = "\033[0m"
BOLD = "\033[1m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
CYAN = "\033[96m"
MAGENTA = "\033[95m"
DIM = "\033[90m"

BACKEND_URL = "http://127.0.0.1:8000/api/telemetry"

class SensorSimulator:
    def __init__(self):
        # Baseline environmental state
        self.temperature = 25.0
        self.humidity = 60.0
        self.pm2_5 = 14.0
        self.mq135 = 410.0
        
        # Fluctuation bounds
        self.temp_bounds = (20.0, 32.0)
        self.humidity_bounds = (45.0, 85.0)
        self.pm25_bounds = (6.0, 55.0)
        self.mq135_bounds = (380.0, 480.0)

    def step(self, inject_spike=False):
        """
        Simulates 30 seconds of physical ambient air fluctuation (Brownian walk + mean reversion).
        """
        # 1. Temperature: small drift (-0.3 to +0.3) with gentle pull towards 25.0C
        temp_drift = random.gauss(0, 0.2) + (25.0 - self.temperature) * 0.05
        self.temperature = max(self.temp_bounds[0], min(self.temp_bounds[1], self.temperature + temp_drift))

        # 2. Humidity: small drift (-0.8 to +0.8) with pull towards 60%
        hum_drift = random.gauss(0, 0.5) + (60.0 - self.humidity) * 0.05
        self.humidity = max(self.humidity_bounds[0], min(self.humidity_bounds[1], self.humidity + hum_drift))

        # 3. PM2.5: Log-normal fluctuation with laser sensor physics
        if inject_spike and random.random() < 0.2:
            pm_drift = random.uniform(15.0, 35.0) # Simulated dust or smoke puff
        else:
            pm_drift = random.gauss(0, 1.2) + (14.0 - self.pm2_5) * 0.08
            
        self.pm2_5 = max(self.pm25_bounds[0], min(self.pm25_bounds[1], self.pm2_5 + pm_drift))

        # 4. Synthesize PM1.0 and PM10 according to laser aerosol optics (PMS5003)
        alpha = random.gauss(0.72, 0.02) # PM1.0 is ~72% of PM2.5
        beta = random.gauss(1.55, 0.05)  # PM10 is ~155% of PM2.5
        
        pm1_0 = max(1.0, round(self.pm2_5 * alpha, 1))
        pm10 = max(pm1_0 + 2.0, round(self.pm2_5 * beta, 1))
        pm2_5 = round(self.pm2_5, 1)

        # 5. MQ135 Gas Sensor drift
        mq_drift = random.gauss(0, 2.0) + (410.0 - self.mq135) * 0.05
        self.mq135 = round(max(self.mq135_bounds[0], min(self.mq135_bounds[1], self.mq135 + mq_drift)), 1)

        return {
            "temperature": round(self.temperature, 1),
            "humidity": round(self.humidity, 1),
            "pm1_0": pm1_0,
            "pm2_5": pm2_5,
            "pm10": pm10,
            "mq135": self.mq135,
            "device_node": "ESP32-RespiGuard-01"
        }

def run_simulator(interval=30, inject_spike=False):
    sim = SensorSimulator()
    
    print(f"\n{BOLD}{CYAN}{'='*75}{RESET}")
    print(f"{BOLD}{GREEN}  RespiGuard IoT Sensor Telemetry Simulator (Active){RESET}")
    print(f"  Target Endpoint : {BACKEND_URL}")
    print(f"  Sampling Period : Every {interval} seconds")
    print(f"  Sensors Model   : DHT22 (Temp/RH) + PMS5003 (PM1.0, 2.5, 10) + MQ135 (Gas)")
    print(f"{BOLD}{CYAN}{'='*75}{RESET}\n")

    cycle_count = 0

    while True:
        cycle_count += 1
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        telemetry = sim.step(inject_spike=inject_spike)

        try:
            # Send telemetry to FastAPI backend
            response = requests.post(BACKEND_URL, json=telemetry, timeout=5.0)
            
            if response.status_code == 200:
                res_data = response.json()
                prediction = res_data.get("prediction", {})
                risk_label = prediction.get("prediction", "Green")
                probs = prediction.get("probabilities", {})
                confidence = prediction.get("confidence", 0)

                # Color formatting based on risk
                if risk_label == "Red":
                    color = RED
                    icon = "🔴"
                elif risk_label == "Yellow":
                    color = YELLOW
                    icon = "🟡"
                else:
                    color = GREEN
                    icon = "🟢"

                print(f"{DIM}[{timestamp}] Cycle #{cycle_count:04d}{RESET}")
                print(f"  {BOLD}Sensors:{RESET} Temp={telemetry['temperature']}°C | RH={telemetry['humidity']}% | PM1.0={telemetry['pm1_0']} | PM2.5={telemetry['pm2_5']} | PM10={telemetry['pm10']} µg/m³ | MQ135={telemetry['mq135']} ppm")
                print(f"  {BOLD}2-Stage ML Risk:{RESET} {color}{BOLD}{icon} {risk_label} ({confidence}% Conf){RESET} | Probs: Green={probs.get('Green', 0)}%, Yellow={probs.get('Yellow', 0)}%, Red={probs.get('Red', 0)}%")
                print(f"  {DIM}Cloud Sync: Stored in Supabase PostgreSQL database successfully.{RESET}")
                print(f"{DIM}{'-'*75}{RESET}")
            else:
                print(f"{RED}[!] Server returned HTTP {response.status_code}: {response.text}{RESET}")

        except requests.exceptions.ConnectionError:
            print(f"{YELLOW}[{timestamp}] Cycle #{cycle_count:04d} -> Backend offline at {BACKEND_URL}. Ensure run_backend.py is running.{RESET}")
        except Exception as e:
            print(f"{RED}[!] Error: {e}{RESET}")

        time.sleep(interval)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="RespiGuard Sensor Simulator")
    parser.add_argument("--interval", type=int, default=30, help="Transmission interval in seconds (default: 30)")
    parser.add_argument("--spike", action="store_true", help="Simulate occasional ambient smoke/dust spikes")
    args = parser.parse_args()

    try:
        run_simulator(interval=args.interval, inject_spike=args.spike)
    except KeyboardInterrupt:
        print(f"\n{YELLOW}[+] Sensor simulator stopped by user.{RESET}")
