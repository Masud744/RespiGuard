"""
RespiGuard IoT Sensor Telemetry Simulator (Hardware-Parity Edition)
===================================================================
Simulates physical hardware node (ESP32 + DHT22 + PMS5003 + MQ135)
Adheres to Phase 3.2 Security Invariants:
1. Cryptographic HMAC-SHA256 canonical signature in header.
2. Monotonic sequence counter enforcement (CAS).
3. Wall-clock UTC ISO-8601 timestamps (bounded drift).
4. Dual-Pipeline ML risk zone and 1-hour rolling AHI reporting.

Usage:
  python sensor_simulator.py                     # Standard 30s live stream
  python sensor_simulator.py --interval 5        # Fast 5s live stream
  python sensor_simulator.py --spike             # Inject occasional pollution spikes
  python sensor_simulator.py --cold              # Simulate cold thermal stress (Patient 343 endotype)
  python sensor_simulator.py --cycles 10         # Stream 10 cycles then stop
"""

import os
import sys
import time
import json
import random
import hmac
import hashlib
import argparse
import requests
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv()

# ANSI Color Codes for terminal
RESET = "\033[0m"
BOLD = "\033[1m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
CYAN = "\033[96m"
MAGENTA = "\033[95m"
DIM = "\033[90m"

DEFAULT_SERVER_HOST = "http://127.0.0.1:8000"
DEFAULT_DEVICE_ID = "ESP32-RespiGuard-01"
DEFAULT_PSK = os.getenv("SIMULATOR_DEVICE_PSK", "respiguard-device-psk-secret-key-2026")

class SensorSimulator:
    def __init__(self, cold_mode=False):
        self.cold_mode = cold_mode
        if cold_mode:
            # Cold thermal stress baseline (Patient 343 endotype: near freezing, high humidity)
            self.temperature = 5.0
            self.humidity = 88.0
            self.pm2_5 = 6.0
            self.mq135 = 395.0
            self.temp_bounds = (1.5, 10.0)
            self.humidity_bounds = (75.0, 95.0)
            self.pm25_bounds = (3.0, 15.0)
            self.mq135_bounds = (370.0, 430.0)
        else:
            # Baseline room/ambient environmental state
            self.temperature = 25.0
            self.humidity = 60.0
            self.pm2_5 = 14.0
            self.mq135 = 410.0
            self.temp_bounds = (18.0, 32.0)
            self.humidity_bounds = (45.0, 85.0)
            self.pm25_bounds = (6.0, 55.0)
            self.mq135_bounds = (380.0, 480.0)

    def step(self, inject_spike=False):
        """
        Simulates physical sensor fluctuations (Brownian walk + mean reversion).
        """
        # 1. Temperature: small drift with pull towards target
        center_t = 5.0 if self.cold_mode else 25.0
        temp_drift = random.gauss(0, 0.2) + (center_t - self.temperature) * 0.05
        self.temperature = max(self.temp_bounds[0], min(self.temp_bounds[1], self.temperature + temp_drift))

        # 2. Humidity: small drift with pull towards target
        center_h = 88.0 if self.cold_mode else 60.0
        hum_drift = random.gauss(0, 0.5) + (center_h - self.humidity) * 0.05
        self.humidity = max(self.humidity_bounds[0], min(self.humidity_bounds[1], self.humidity + hum_drift))

        # 3. PM2.5: Laser counter fluctuation
        if inject_spike and random.random() < 0.25:
            pm_drift = random.uniform(25.0, 50.0) # Simulated particulate puff
        else:
            center_pm = 6.0 if self.cold_mode else 14.0
            pm_drift = random.gauss(0, 1.2) + (center_pm - self.pm2_5) * 0.08
            
        self.pm2_5 = max(self.pm25_bounds[0], min(self.pm25_bounds[1], self.pm2_5 + pm_drift))

        # 4. Synthesize PM1.0 and PM10 according to laser aerosol optics (PMS5003)
        alpha = random.gauss(0.72, 0.02)
        beta = random.gauss(1.55, 0.05)
        
        pm1_0 = max(1.0, round(self.pm2_5 * alpha, 1))
        pm10 = max(pm1_0 + 2.0, round(self.pm2_5 * beta, 1))
        pm2_5 = round(self.pm2_5, 1)

        # 5. MQ135 Gas Sensor drift
        center_mq = 395.0 if self.cold_mode else 410.0
        mq_drift = random.gauss(0, 2.0) + (center_mq - self.mq135) * 0.05
        self.mq135 = round(max(self.mq135_bounds[0], min(self.mq135_bounds[1], self.mq135 + mq_drift)), 1)

        return {
            "temperature": round(self.temperature, 1),
            "humidity": round(self.humidity, 1),
            "pm1_0": pm1_0,
            "pm2_5": pm2_5,
            "pm10": pm10,
            "mq135": self.mq135
        }


def compute_telemetry_canonical_string(device_node: str, timestamp_str: str, seq_num: int, payload_sha256: str) -> str:
    """Matches backend/auth.py canonical string format exactly."""
    return f"DEVICE_ID:{device_node}\nTIMESTAMP:{timestamp_str}\nSEQUENCE:{seq_num}\nPAYLOAD_SHA256:{payload_sha256}"


def run_simulator(host=DEFAULT_SERVER_HOST, device_id=DEFAULT_DEVICE_ID, interval=30, 
                  inject_spike=False, cold_mode=False, user_id=None, cycles=None, secret=DEFAULT_PSK):
    sim = SensorSimulator(cold_mode=cold_mode)
    target_url = f"{host.rstrip('/')}/api/telemetry"
    seq_num = 1
    try:
        r = requests.get(f"{host.rstrip('/')}/api/telemetry/latest", timeout=3.0)
        if r.status_code == 200:
            last_seq = r.json().get("telemetry", {}).get("seq_num")
            if last_seq and isinstance(last_seq, int):
                seq_num = last_seq + 1
    except Exception:
        pass

    mode_desc = "Cold Thermal Stress (Patient 343)" if cold_mode else "Standard Physical Sensor Baseline"
    print(f"\n{BOLD}{CYAN}{'='*80}{RESET}")
    print(f"{BOLD}{GREEN}  RespiGuard IoT Sensor Telemetry Simulator (Active){RESET}")
    print(f"  Target Endpoint : {target_url}")
    print(f"  Device Node ID  : {device_id}")
    print(f"  Auth Method     : HMAC-SHA256 Signature (PSK Verified)")
    print(f"  Sampling Period : Every {interval} seconds")
    print(f"  Physical Mode   : {mode_desc}")
    if user_id:
        print(f"  Enrolled Patient: {user_id} (Mode B Calibrated Telehealth)")
    else:
        print(f"  Enrolled Patient: None (Mode A Pure Sensor Live Streaming)")
    print(f"{BOLD}{CYAN}{'='*80}{RESET}\n")

    completed_cycles = 0

    while True:
        completed_cycles += 1
        now_dt = datetime.now(timezone.utc)
        timestamp_iso = now_dt.isoformat()
        reading = sim.step(inject_spike=inject_spike)

        telemetry_payload = {
            "temperature": reading["temperature"],
            "humidity": reading["humidity"],
            "pm1_0": reading["pm1_0"],
            "pm2_5": reading["pm2_5"],
            "pm10": reading["pm10"],
            "mq135": reading["mq135"],
            "device_node": device_id,
            "seq_num": seq_num,
            "age": 30.0
        }
        if user_id:
            telemetry_payload["user_id"] = user_id

        # Compute cryptographic HMAC-SHA256 signature
        raw_body = json.dumps(telemetry_payload).encode("utf-8")
        payload_sha256 = hashlib.sha256(raw_body).hexdigest()
        canonical_string = compute_telemetry_canonical_string(
            device_node=device_id,
            timestamp_str=timestamp_iso,
            seq_num=seq_num,
            payload_sha256=payload_sha256
        )
        signature = hmac.new(secret.encode("utf-8"), canonical_string.encode("utf-8"), hashlib.sha256).hexdigest()

        headers = {
            "Content-Type": "application/json",
            "X-Device-Id": device_id,
            "X-Device-Sequence": str(seq_num),
            "X-Device-Timestamp": timestamp_iso,
            "X-Device-Signature": signature
        }

        try:
            response = requests.post(target_url, data=raw_body, headers=headers, timeout=6.0)
            
            if response.status_code == 200:
                res_data = response.json()
                pred = res_data.get("prediction", {})
                risk_label = pred.get("prediction", "Green")
                probs = pred.get("probabilities", {})
                confidence = pred.get("confidence", 0)
                pipe_mode = pred.get("pipeline_mode", "mode_a_pure_sensor")
                impacts = pred.get("feature_impacts", [])
                top_impact = impacts[0] if impacts else None

                env = res_data.get("environmental_hazard", {})
                ahi_score = env.get("ahi")
                ahi_str = f"AHI: {ahi_score}" if ahi_score is not None else "AHI: Initializing"
                env_status = env.get("status", "")

                # Risk badge color
                if risk_label == "Red":
                    color, icon = RED, "🔴"
                elif risk_label == "Yellow":
                    color, icon = YELLOW, "🟡"
                else:
                    color, icon = GREEN, "🟢"

                ts_display = now_dt.strftime("%H:%M:%S UTC")
                print(f"{DIM}[{ts_display}] Packet #{seq_num:04d} | Node: {device_id}{RESET}")
                print(f"  {BOLD}Sensors:{RESET} Temp={reading['temperature']}°C | RH={reading['humidity']}% | PM1.0={reading['pm1_0']} | PM2.5={reading['pm2_5']} | PM10={reading['pm10']} µg/m³ | MQ135={reading['mq135']} ppm")
                print(f"  {BOLD}Dual-Pipeline ML:{RESET} {color}{BOLD}{icon} {risk_label} ({confidence}% Conf){RESET} [{pipe_mode}] | G={probs.get('Green', 0)}% Y={probs.get('Yellow', 0)}% R={probs.get('Red', 0)}%")
                if top_impact:
                    print(f"  {BOLD}Top Driver:{RESET} {top_impact['name']} ({top_impact['value']}{top_impact['unit']}) -> {top_impact['contribution_pct']}% impact ({top_impact['direction']})")
                print(f"  {CYAN}Metrology Index:{RESET} {ahi_str} | Status: {env_status}")
                print(f"{DIM}{'-'*80}{RESET}")
                
                seq_num += 1 # Advance monotonic counter upon success
            elif response.status_code == 409:
                print(f"{YELLOW}[!] HTTP 409 Conflict: Monotonic sequence replay detected. Incrementing counter...{RESET}")
                seq_num += 5
            else:
                print(f"{RED}[!] Server error (HTTP {response.status_code}): {response.text}{RESET}")

        except requests.exceptions.ConnectionError:
            print(f"{YELLOW}[{now_dt.strftime('%H:%M:%S')}] Connection failed to {target_url}. Is backend running on port 8000?{RESET}")
        except Exception as e:
            print(f"{RED}[!] Transmission error: {e}{RESET}")

        if cycles and completed_cycles >= cycles:
            print(f"\n{GREEN}[✓] Completed {cycles} telemetry simulation cycles. Exiting.{RESET}")
            break

        time.sleep(interval)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="RespiGuard Hardware-Parity Sensor Simulator")
    parser.add_argument("--interval", type=int, default=30, help="Transmission period in seconds (default: 30)")
    parser.add_argument("--spike", action="store_true", help="Simulate occasional ambient particulate spikes")
    parser.add_argument("--cold", action="store_true", help="Simulate cold-air thermal strain (Patient 343 scenario)")
    parser.add_argument("--cycles", type=int, default=None, help="Stop after N cycles (default: continuous)")
    parser.add_argument("--device-id", type=str, default=DEFAULT_DEVICE_ID, help="Device node identifier")
    parser.add_argument("--user-id", type=str, default=None, help="Associated patient UUID for Mode B calibration")
    parser.add_argument("--host", type=str, default=DEFAULT_SERVER_HOST, help="Target backend server URL")
    args = parser.parse_args()

    try:
        run_simulator(
            host=args.host,
            device_id=args.device_id,
            interval=args.interval,
            inject_spike=args.spike,
            cold_mode=args.cold,
            user_id=args.user_id,
            cycles=args.cycles
        )
    except KeyboardInterrupt:
        print(f"\n{YELLOW}[*] Sensor simulator halted by user.{RESET}")
        sys.exit(0)
