"""
RespiGuard Environmental Hazard Scoring & Metrology Engine
Version: 2.2.1-production-engine
Module: ml_pipeline/environmental_hazard_engine.py

Regulatory Distinctions & Metrology Notice:
- The RespiGuard 1-hour particulate sub-index is a near-real-time engineering exposure metric
  adapted for low-cost portable sensors (PMS5003). It is NOT official US EPA Air Quality Index (AQI),
  which is legally defined as a 24-hour averaged regulatory metric. It cannot be used for statutory
  attainment or compliance reporting.
- Adaptation Limitation: EPA AQI breakpoints were established for 24-hour chronic exposures.
  Adapting these numerical boundaries to a 1-hour rolling window is an engineering heuristic.
  Transient 1-hour particulate spikes may exceed numerical thresholds without indicating a violation
  of 24-hour ambient standards.
- Regulatory Standard Separation:
  * Annual NAAQS: The US EPA primary annual PM2.5 standard is 9.0 µg/m³ (2024 revision, 3-year mean).
  * 24-Hour Standards: The 24-hour PM2.5 standard is 35.0 µg/m³; the 24-hour PM10 standard is 150 µg/m³.
  * AQI Reporting Breakpoints: EPA daily AQI reporting tables define operational piecewise boundaries
    (e.g., 0-50, 51-100, 101-150). RespiGuard uses the 9.0 µg/m³ annual standard as the upper bound
    of its baseline 'Low' bracket (0-50) and adapted 24-hour AQI breakpoints for higher tiers.

Provides:
- Robust scalar input validation (rejecting None, bool, non-numeric, NaN, Inf, physical bounds)
- Continuous contiguous PM2.5 and PM10 breakpoint interpolation (zero fallthrough)
- Complete NOAA NWS Heat Index with safe square-root and boundary conditions
- Explicit round-half-up policy for AHI scoring (floor(val + 0.5))
- TimestampedRollingWindow with trapezoidal integration and 75% data-sufficiency rule
- Thermal Multiplier disabled by default (ENABLE_THERMAL_MULTIPLIER = False)
- Strictly neutral environmental exposure categorization (no clinical diagnosis or medical guidance)
"""
import math
from collections import deque

ENABLE_THERMAL_MULTIPLIER = False  # Disabled by default in baseline production

def round_half_up(val):
    """
    Standard round-half-up rounding implemented as floor(val + 0.5).
    
    Domain & Operational Intent:
        Intended primarily for non-negative exposure metrics (AHI scores in [0, 500],
        and rolling window data-completeness percentages in [0, 100]%).
        Within the RespiGuard MetrologyEngine, any negative raw inputs are pre-clamped
        to 0.0 before rounding.

    Tie-Breaking & Negative Input Behavior:
        Ties (.5) break towards positive infinity (round up):
        - Non-negative examples:
            round_half_up(0.49)  -> 0
            round_half_up(0.50)  -> 1  (Python built-in round(0.5) returns 0)
            round_half_up(2.49)  -> 2
            round_half_up(2.50)  -> 3  (Python built-in round(2.5) returns 2)
            round_half_up(50.50) -> 51 (Python built-in round(50.5) returns 50)
        - Negative input behavior (floor(val + 0.5)):
            round_half_up(-0.49) -> 0
            round_half_up(-0.50) -> 0  (tie rounds towards +inf: -0.5 + 0.5 = 0.0)
            round_half_up(-0.51) -> -1
            round_half_up(-1.50) -> -1 (tie rounds towards +inf: -1.5 + 0.5 = -1.0)
    """
    return int(math.floor(val + 0.5))


class MetrologyEngine:
    VERSION = "2.2.1"

    @staticmethod
    def validate_numeric(val, name, min_val, max_val):
        """
        Validates that val is a finite float or int scalar within [min_val, max_val].
        Explicitly rejects bool (which subclasses int in Python), strings, lists, dicts,
        None, NaN, and Inf.
        """
        if val is None:
            return False, None, f"ERROR_NULL_{name.upper()}"
        if isinstance(val, bool):  # In Python, bool is a subclass of int!
            return False, None, f"ERROR_TYPE_{name.upper()}"
        if not isinstance(val, (int, float)):
            return False, None, f"ERROR_TYPE_{name.upper()}"
        if math.isnan(val):
            return False, None, f"ERROR_NAN_{name.upper()}"
        if math.isinf(val):
            return False, None, f"ERROR_INF_{name.upper()}"
        val_float = float(val)
        if not (min_val <= val_float <= max_val):
            return False, None, f"ERROR_OUT_OF_RANGE_{name.upper()}"
        return True, val_float, "OK"

    @staticmethod
    def calculate_heat_index(T_c, RH):
        """
        Calculates NOAA NWS Heat Index strictly following the complete algorithm
        (Rothfusz 1990; Steadman 1979) with explicit input validation and safe arithmetic.
        """
        # 1. Input Validation
        valid_t, T_c_val, err_t = MetrologyEngine.validate_numeric(T_c, "temp", -40.0, 60.0)
        if not valid_t:
            return {"status": err_t, "error": f"Invalid temperature: {err_t}"}

        valid_rh, RH_val, err_rh = MetrologyEngine.validate_numeric(RH, "rh", 0.0, 100.0)
        if not valid_rh:
            return {"status": err_rh, "error": f"Invalid relative humidity: {err_rh}"}

        # 2. Fahrenheit Conversion
        T_f = T_c_val * (9.0 / 5.0) + 32.0

        # 3. Simple Steadman Formula
        HI_simple = 0.5 * (T_f + 61.0 + ((T_f - 68.0) * 1.2) + (RH_val * 0.094))
        screening_avg = (HI_simple + T_f) / 2.0

        # 4. Screening Check (Screening average strictly < 80°F)
        if screening_avg < 80.0:
            return {
                "status": "OK",
                "T_c": T_c_val,
                "T_f": T_f,
                "RH": RH_val,
                "HI_simple": HI_simple,
                "screening_avg": screening_avg,
                "HI_full": None,
                "adj": 0.0,
                "branch": "SIMPLE_BRANCH",
                "HI_f": HI_simple,
                "HI_c": (HI_simple - 32.0) * (5.0 / 9.0)
            }

        # 5. Full 9-Term Rothfusz Regression Equation
        c1, c2, c3 = -42.379, 2.04901523, 10.14333127
        c4, c5, c6 = -0.22475541, -0.00683763, -0.05481717
        c7, c8, c9 = 0.00122874, 0.00085282, -0.00000199

        HI_full = (
            c1 + c2 * T_f + c3 * RH_val + c4 * T_f * RH_val +
            c5 * (T_f ** 2) + c6 * (RH_val ** 2) + c7 * (T_f ** 2) * RH_val +
            c8 * T_f * (RH_val ** 2) + c9 * (T_f ** 2) * (RH_val ** 2)
        )

        # 6. Adjustment Branches with Safe Square Root Argument
        if RH_val < 13.0 and (80.0 <= T_f <= 112.0):
            # Guard against any negative argument under sqrt
            sqrt_arg = max(0.0, (17.0 - abs(T_f - 95.0)) / 17.0)
            adj = -((13.0 - RH_val) / 4.0) * math.sqrt(sqrt_arg)
            HI_f = HI_full + adj
            branch = "DRY_ADJUSTMENT"
        elif RH_val > 85.0 and (80.0 <= T_f <= 87.0):
            adj = ((RH_val - 85.0) / 10.0) * ((87.0 - T_f) / 5.0)
            HI_f = HI_full + adj
            branch = "HUMID_ADJUSTMENT"
        else:
            adj = 0.0
            HI_f = HI_full
            branch = "FULL_ROTHFUSZ_STANDARD"

        return {
            "status": "OK",
            "T_c": T_c_val,
            "T_f": T_f,
            "RH": RH_val,
            "HI_simple": HI_simple,
            "screening_avg": screening_avg,
            "HI_full": HI_full,
            "adj": adj,
            "branch": branch,
            "HI_f": HI_f,
            "HI_c": (HI_f - 32.0) * (5.0 / 9.0)
        }

    @staticmethod
    def get_thermal_multiplier(HI_f, T_c, RH, enable_thermal_multiplier=ENABLE_THERMAL_MULTIPLIER):
        """
        Provisional thermal stress multiplier.
        Disabled by default in baseline mode (returns 1.00).
        Carries ZERO clinical validation; strictly an engineering heuristic.
        """
        if not enable_thermal_multiplier or HI_f is None:
            return 1.00

        # Heat heuristic
        if HI_f < 80.0:
            m_heat = 1.00
        elif HI_f < 90.0:
            m_heat = 1.10
        elif HI_f < 103.0:
            m_heat = 1.20
        else:
            m_heat = 1.35

        # Cold/dry heuristic
        if T_c < 0.0 and RH < 40.0:
            m_cold = 1.25
        elif T_c < 10.0 and RH < 40.0:
            m_cold = 1.10
        else:
            m_cold = 1.00

        return max(m_heat, m_cold)

    @staticmethod
    def calculate_pm_subindex(c_dry, pollutant="PM2.5"):
        """
        Calculates particulate sub-index using continuous, contiguous half-open intervals.
        Guarantees zero gaps, zero jumps, and zero fallthrough across all valid floats.

        Regulatory Standards & Adaptation Note:
        - This function evaluates a 1-hour time-weighted average engineering sub-index.
        - It is NOT official US EPA AQI (which requires a regulatory 24-hour average).
        - PM2.5 brackets adapt EPA AQI reporting intervals, incorporating the 2024 annual
          NAAQS standard (9.0 µg/m³) for the baseline bracket [0.0, 9.0] -> [0, 50].
        - PM10 brackets adapt continuous EPA AQI reporting intervals [0.0, 54.0] -> [0, 50].
        - Adaptation Limitation: Short-term 1-hour particulate spikes may register an elevated
          sub-index without implying a violation of statutory 24-hour NAAQS limits.
        """
        valid_c, c_val, err_c = MetrologyEngine.validate_numeric(c_dry, "pm_conc", 0.0, 5000.0)
        if not valid_c:
            return 0.0

        if pollutant == "PM2.5":
            # Continuous non-overlapping brackets [C_low, C_high] -> [I_low, I_high]
            # Based on US EPA NAAQS 2024 revised boundaries
            brackets = [
                (0.0, 9.0, 0.0, 50.0),
                (9.0, 35.4, 50.0, 100.0),
                (35.4, 55.4, 100.0, 150.0),
                (55.4, 125.4, 150.0, 200.0),
                (125.4, 225.4, 200.0, 300.0),
                (225.4, 500.4, 300.0, 500.0)
            ]
        else:  # PM10
            brackets = [
                (0.0, 54.0, 0.0, 50.0),
                (54.0, 154.0, 50.0, 100.0),
                (154.0, 254.0, 100.0, 150.0),
                (254.0, 354.0, 150.0, 200.0),
                (354.0, 424.0, 200.0, 300.0),
                (424.0, 604.0, 300.0, 500.0)
            ]

        # Lower clamp
        if c_val <= 0.0:
            return 0.0

        # Contiguous interval evaluation
        for c_low, c_high, i_low, i_high in brackets:
            if c_low < c_val <= c_high or (c_low == 0.0 and c_val == 0.0):
                return ((i_high - i_low) / (c_high - c_low)) * (c_val - c_low) + i_low

        # Upper clamp
        return 500.0

    @staticmethod
    def compute_ahi(I_base, M_thermal=1.00):
        """
        Computes Air Hazard Index and categorizes into neutral environmental tiers.
        Enforces:
        - Lower clamp at 0
        - Upper clamp at 500
        - Standard round-half-up rounding policy (floor(val + 0.5))
        - Neutral environmental category mapping (zero clinical diagnosis or treatment claims)

        Category Tiers & Neutral Environmental Guidance:
        - 0 - 50: "Low Environmental Hazard" (Satisfactory ambient air quality)
        - 51 - 100: "Moderate Environmental Hazard" (Acceptable ambient air quality)
        - 101 - 150: "Elevated Environmental Hazard" (Elevated ambient particulate concentration)
        - 151 - 200: "High Environmental Hazard" (High ambient particulate concentration)
        - 201 - 500: "Critical Environmental Hazard" (Very high ambient particulate concentration)
        """
        # Lower clamp
        if I_base < 0.0 or M_thermal <= 0.0:
            raw_product = 0.0
        else:
            raw_product = I_base * M_thermal

        # Standard round-half-up and upper clamp at 500
        rounded_val = round_half_up(raw_product)
        final_ahi = min(500, max(0, rounded_val))

        # Neutral category assignment
        if final_ahi <= 50:
            category = "Low Environmental Hazard"
        elif final_ahi <= 100:
            category = "Moderate Environmental Hazard"
        elif final_ahi <= 150:
            category = "Elevated Environmental Hazard"
        elif final_ahi <= 200:
            category = "High Environmental Hazard"
        else:
            category = "Critical Environmental Hazard"

        return final_ahi, category


# Rolling Window Status Constants
STATUS_EMPTY_BUFFER = "STATUS_EMPTY_BUFFER"
STATUS_SENSOR_OFFLINE_STALE = "STATUS_SENSOR_OFFLINE_STALE"
STATUS_INITIALIZING = "STATUS_INITIALIZING"
STATUS_PROVISIONAL_SHORT_TERM = "STATUS_PROVISIONAL_SHORT_TERM"
STATUS_VALIDATED_1HOUR = "STATUS_VALIDATED_1HOUR"
# Semantic alias indicating computational temporal data-sufficiency (>= 2700s / >= 75%)
STATUS_DATA_SUFFICIENT_1HOUR = STATUS_VALIDATED_1HOUR


class TimestampedRollingWindow:
    """
    Timestamp-based rolling exposure window (1-hour nominal = 3600.0 seconds).
    Implements:
    - Piecewise trapezoidal time-weighted integration
    - Strict internal RespiGuard 75% computational data-sufficiency rule (valid_duration >= 2700s)
    - Rejection of duplicates, out-of-order timestamps, and non-numeric data
    - Stale sensor timeout (>= 300s since last sample)
    - Device restart / buffer reset

    STATUS Terminology & Backward Compatibility:
    - STATUS_VALIDATED_1HOUR is retained as the wire/API status token across API payloads and
      engine responses to maintain strict backward compatibility with existing frontends,
      client consumers, and test suites.
    - Semantically, it is functionally synonymous with STATUS_DATA_SUFFICIENT_1HOUR. It strictly
      indicates COMPUTATIONAL DATA SUFFICIENCY (i.e., >= 2700.0s of valid sensor samples within
      the nominal 3600.0s window, or >= 75% completeness).
    - It does NOT imply hardware sensor measurement accuracy, statutory regulatory validation
      (e.g., official EPA AQI), or clinical validation / personal health-risk prediction.
    - In user-facing documentation and API contracts, this metric represents a "1-Hour Data-Sufficient AHI".

    Telemetry Sampling Interval & Window Initialization:
    - In reference implementations (sensor_simulator.py), the nominal telemetry transmission cadence
      is 30 seconds per packet (--interval 30).
    - Window initialization requires BOTH total_span >= 180.0s AND n_samples >= 6.
    - 6 samples only equals 3 minutes if the transmitting node maintains a strictly uniform 30-second cadence.
      If telemetry transmission period is not 30 seconds (e.g. variable network latency, packet loss, or
      custom device polling rates), elapsed timestamp duration and sample count decouple.

    Initializing-State and Provisional Exposure Policy:
    - STATUS_INITIALIZING (<180.0s span or <6 samples): returns weighted_average=None. Downstream
      consumers return ahi=None. Instantaneous single-packet measurements are NEVER masqueraded
      as a 1-hour rolling AHI.
    - STATUS_PROVISIONAL_SHORT_TERM (180.0s <= span < 2700.0s): returns interim time-weighted average,
      explicitly flagged with is_valid=False and is_provisional=True. Documented as a provisional
      short-term estimate not equivalent to a 1-hour rolling AHI.
    """
    def __init__(self, window_seconds=3600.0, gap_threshold_seconds=90.0, stale_threshold_seconds=300.0):
        self.window_seconds = window_seconds
        self.gap_threshold_seconds = gap_threshold_seconds
        self.stale_threshold_seconds = stale_threshold_seconds
        self.buffer = deque()  # stores (t_epoch, val)
        self.rejected_duplicates = 0
        self.rejected_out_of_order = 0
        self.rejected_invalid = 0

    def reset(self):
        """Clears buffer (e.g. on device restart)."""
        self.buffer.clear()
        self.rejected_duplicates = 0
        self.rejected_out_of_order = 0
        self.rejected_invalid = 0

    def add_sample(self, t_epoch, value):
        """Adds a sample with timestamp validation."""
        # Validate value
        if value is None or isinstance(value, bool) or not isinstance(value, (int, float)):
            self.rejected_invalid += 1
            return False, "REJECTED_INVALID_TYPE"
        if math.isnan(value) or math.isinf(value) or value < 0.0:
            self.rejected_invalid += 1
            return False, "REJECTED_INVALID_VALUE"

        # Validate timestamp
        if len(self.buffer) > 0:
            latest_t, _ = self.buffer[-1]
            if t_epoch == latest_t:
                self.rejected_duplicates += 1
                return False, "REJECTED_DUPLICATE_TIMESTAMP"
            if t_epoch < latest_t:
                self.rejected_out_of_order += 1
                return False, "REJECTED_OUT_OF_ORDER_TIMESTAMP"

        self.buffer.append((float(t_epoch), float(value)))
        return True, "ACCEPTED"

    def evaluate(self, current_time):
        """
        Evaluates the rolling window at current_time.
        Returns metrics, data sufficiency status, and completeness percentage.

        Data Sufficiency Status Meaning:
        - STATUS_EMPTY_BUFFER: Zero samples in active window (ahi=None, is_provisional=True).
        - STATUS_SENSOR_OFFLINE_STALE: Gap from latest sample >= 300s (ahi=None, is_provisional=True).
        - STATUS_INITIALIZING: Buffer has < 180s or < 6 samples (weighted_average=None, ahi=None).
        - STATUS_PROVISIONAL_SHORT_TERM: 180s <= valid_duration < 2700s (interim average; provisional;
          not equivalent to a 1-hour rolling AHI).
        - STATUS_VALIDATED_1HOUR: valid_duration >= 2700s (computational data sufficiency only;
          1-Hour Data-Sufficient AHI; zero claim of clinical or sensor accuracy validation).
        """
        # 1. Prune samples older than window_seconds
        min_allowed_t = current_time - self.window_seconds
        while len(self.buffer) > 0 and self.buffer[0][0] < min_allowed_t:
            self.buffer.popleft()

        # 2. Check if buffer is empty
        if len(self.buffer) == 0:
            return {
                "status": "STATUS_EMPTY_BUFFER",
                "is_valid": False,
                "is_provisional": True,
                "completeness_pct": 0,
                "valid_duration_seconds": 0.0,
                "weighted_average": None
            }

        # 3. Check for Stale Sensor (gap from latest sample to current_time >= stale_threshold)
        latest_t, _ = self.buffer[-1]
        time_since_last = current_time - latest_t
        if time_since_last >= self.stale_threshold_seconds:
            return {
                "status": "STATUS_SENSOR_OFFLINE_STALE",
                "is_valid": False,
                "is_provisional": True,
                "time_since_last_sample": time_since_last,
                "completeness_pct": 0,
                "valid_duration_seconds": 0.0,
                "weighted_average": None
            }

        # 4. Check for Initializing (< 180s span or < 6 samples; 6 samples = 180s only under nominal 30s cadence)
        earliest_t, _ = self.buffer[0]
        total_span = latest_t - earliest_t
        n_samples = len(self.buffer)
        if total_span < 180.0 or n_samples < 6:
            return {
                "status": "STATUS_INITIALIZING",
                "is_valid": False,
                "is_provisional": True,
                "n_samples": n_samples,
                "completeness_pct": round_half_up((total_span / self.window_seconds) * 100),
                "valid_duration_seconds": total_span,
                "weighted_average": None
            }

        # 5. Time-Weighted Trapezoidal Integration with Gap Handling
        valid_duration = 0.0
        weighted_sum = 0.0

        for i in range(len(self.buffer) - 1):
            t_curr, v_curr = self.buffer[i]
            t_next, v_next = self.buffer[i + 1]
            dt = t_next - t_curr

            if dt <= self.gap_threshold_seconds:
                valid_duration += dt
                weighted_sum += 0.5 * (v_curr + v_next) * dt
            else:
                # Gap detected (>90s): duration is uncounted in valid_duration
                pass

        # Also account for tail up to current_time if within gap threshold
        tail_dt = current_time - latest_t
        if tail_dt <= self.gap_threshold_seconds:
            valid_duration += tail_dt
            weighted_sum += self.buffer[-1][1] * tail_dt

        # 6. Apply 75% Data-Sufficiency Engineering Rule (2700s out of 3600s)
        completeness_pct = min(100, round_half_up((valid_duration / self.window_seconds) * 100))
        mean_val = (weighted_sum / valid_duration) if valid_duration > 0 else 0.0

        if valid_duration < 2700.0:
            return {
                "status": "STATUS_PROVISIONAL_SHORT_TERM",
                "is_valid": False,
                "is_provisional": True,
                "n_samples": n_samples,
                "completeness_pct": completeness_pct,
                "valid_duration_seconds": valid_duration,
                "weighted_average": mean_val
            }

        return {
            "status": "STATUS_VALIDATED_1HOUR",
            "is_valid": True,
            "is_provisional": False,
            "n_samples": n_samples,
            "completeness_pct": completeness_pct,
            "valid_duration_seconds": valid_duration,
            "weighted_average": mean_val
        }
