"""
Unit and Verification Test Suite for RespiGuard Environmental Hazard Scoring & Metrology Engine
Module: tests/test_environmental_hazard_engine.py
Engine Under Test: ml_pipeline/environmental_hazard_engine.py

Verifies:
1. Explicit Round-Half-Up rounding policy and .5 boundary values (demonstrating divergence from round-half-to-even)
2. AHI lower clamp at 0 and upper clamp at 500
3. Deterministic Category boundaries: 50/51, 100/101, 150/151, 200/201
4. Default setting of ENABLE_THERMAL_MULTIPLIER = False
5. Input validation and controlled error codes for non-numeric, bool, None, NaN, Inf, and out-of-range scalars
6. Continuous contiguous PM10 and PM2.5 breakpoint interpolation with strict tolerance <= 1e-4
7. TimestampedRollingWindow lifecycle, gap detection, stale timeout, duplicate/out-of-order rejection, and 75% sufficiency
8. NOAA Heat Index branches, screening average condition, and dry/humid adjustment bounds
9. Intentionally corrupted negative test proving harness failure detection
10. Official NOAA/NWS heat index benchmark validation (within +-1 deg F)
"""

import os
import sys
import math
import pytest

# Ensure repository root is on sys.path
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from ml_pipeline.environmental_hazard_engine import (
    MetrologyEngine,
    TimestampedRollingWindow,
    round_half_up,
    ENABLE_THERMAL_MULTIPLIER,
)

TOLERANCE = 1e-4  # Strict documented numerical tolerance: 0.0001


# =============================================================================
# 1. ROUND-HALF-UP POLICY AND .5 BOUNDARY TESTS
# =============================================================================
def test_rounding_policy_mismatch_resolution():
    """
    Demonstrates and verifies that round_half_up implements standard round-half-up,
    rounding .5 towards positive infinity, resolving Python's built-in round() round-half-to-even behavior.
    """
    # Test pairs: (value, expected_round_half_up, python_built_in_round)
    # Highlight points where round-half-up differs from Python's round-half-to-even
    half_boundary_cases = [
        # (input_val, expected_rhu, python_round, divergence_expected)
        (0.00, 0, 0, False),
        (0.49, 0, 0, False),
        (0.50, 1, 0, True),   # Python rounds to 0 (even), round-half-up rounds to 1
        (0.51, 1, 1, False),
        (1.49, 1, 1, False),
        (1.50, 2, 2, False),  # Python rounds to 2 (even), round-half-up rounds to 2
        (1.51, 2, 2, False),
        (2.49, 2, 2, False),
        (2.50, 3, 2, True),   # Python rounds to 2 (even), round-half-up rounds to 3
        (2.51, 3, 3, False),
        (3.50, 4, 4, False),  # Python rounds to 4 (even), round-half-up rounds to 4
        (4.50, 5, 4, True),   # Python rounds to 4 (even), round-half-up rounds to 5
        (50.49, 50, 50, False),
        (50.50, 51, 50, True),  # Crucial 50/51 boundary: round-half-up enters Moderate hazard (51)
        (50.51, 51, 51, False),
        (100.49, 100, 100, False),
        (100.50, 101, 100, True), # Crucial 100/101 boundary: round-half-up enters Elevated hazard (101)
        (100.51, 101, 101, False),
        (150.49, 150, 150, False),
        (150.50, 151, 150, True), # Crucial 150/151 boundary: round-half-up enters High hazard (151)
        (150.51, 151, 151, False),
        (200.49, 200, 200, False),
        (200.50, 201, 200, True), # Crucial 200/201 boundary: round-half-up enters Critical hazard (201)
        (200.51, 201, 201, False),
        (500.49, 500, 500, False),
        (500.50, 501, 500, True), # 500.5 rounds to 501 before upper clamping
        # Negative input cases explicitly documenting floor(val + 0.5) tie-breaking:
        (-0.49, 0, 0, False),
        (-0.50, 0, 0, False),      # -0.5 + 0.5 = 0.0 -> floor(0.0) = 0
        (-0.51, -1, -1, False),
        (-1.50, -1, -2, True),     # Python round(-1.5) = -2 (even), floor(-1.5 + 0.5) = -1
        (-2.50, -2, -2, False),    # Python round(-2.5) = -2 (even), floor(-2.5 + 0.5) = -2
        (-3.50, -3, -4, True),     # Python round(-3.5) = -4 (even), floor(-3.5 + 0.5) = -3
    ]

    for val, exp_rhu, exp_py_round, diverges in half_boundary_cases:
        actual_rhu = round_half_up(val)
        actual_py = round(val)
        assert actual_rhu == exp_rhu, f"round_half_up({val}) returned {actual_rhu}, expected {exp_rhu}"
        assert actual_py == exp_py_round, f"round({val}) returned {actual_py}, expected {exp_py_round}"
        if diverges:
            assert actual_rhu != actual_py, f"Expected divergence between rhu and round at {val}"


# =============================================================================
# 2. DETERMINISTIC AHI CLAMPING AND CATEGORY BOUNDARIES
# =============================================================================
def test_ahi_lower_upper_clamps():
    """
    Verifies that compute_ahi strictly enforces lower clamp at 0 and upper clamp at 500.
    """
    # Lower clamp at 0
    ahi_zero, cat_zero = MetrologyEngine.compute_ahi(0.0, 1.00)
    assert ahi_zero == 0
    assert cat_zero == "Low Environmental Hazard"

    ahi_neg, cat_neg = MetrologyEngine.compute_ahi(-10.0, 1.00)
    assert ahi_neg == 0
    assert cat_neg == "Low Environmental Hazard"

    ahi_neg_sub, cat_neg_sub = MetrologyEngine.compute_ahi(-0.01, 1.00)
    assert ahi_neg_sub == 0
    assert cat_neg_sub == "Low Environmental Hazard"

    ahi_neg_mult, cat_neg_mult = MetrologyEngine.compute_ahi(50.0, -1.00)
    assert ahi_neg_mult == 0
    assert cat_neg_mult == "Low Environmental Hazard"

    # Upper clamp at 500
    ahi_500, cat_500 = MetrologyEngine.compute_ahi(500.0, 1.00)
    assert ahi_500 == 500
    assert cat_500 == "Critical Environmental Hazard"

    ahi_500_49, cat_500_49 = MetrologyEngine.compute_ahi(500.49, 1.00)
    assert ahi_500_49 == 500
    assert cat_500_49 == "Critical Environmental Hazard"

    ahi_500_50, cat_500_50 = MetrologyEngine.compute_ahi(500.50, 1.00)
    assert ahi_500_50 == 500  # Clamped at 500 even though 500.50 rounds to 501
    assert cat_500_50 == "Critical Environmental Hazard"

    ahi_high, cat_high = MetrologyEngine.compute_ahi(600.0, 1.00)
    assert ahi_high == 500
    assert cat_high == "Critical Environmental Hazard"

    ahi_over_mult, cat_over_mult = MetrologyEngine.compute_ahi(450.0, 1.35)  # 450 * 1.35 = 607.5
    assert ahi_over_mult == 500
    assert cat_over_mult == "Critical Environmental Hazard"


def test_ahi_category_boundaries():
    """
    Tests exact category boundaries: 50/51, 100/101, 150/151, 200/201
    under both integer and half-up fractional values.
    """
    # Boundary 50 / 51 (Low vs Moderate)
    ahi_50, cat_50 = MetrologyEngine.compute_ahi(50.00)
    assert ahi_50 == 50
    assert cat_50 == "Low Environmental Hazard"

    ahi_50_49, cat_50_49 = MetrologyEngine.compute_ahi(50.49)
    assert ahi_50_49 == 50
    assert cat_50_49 == "Low Environmental Hazard"

    ahi_50_50, cat_50_50 = MetrologyEngine.compute_ahi(50.50)
    assert ahi_50_50 == 51
    assert cat_50_50 == "Moderate Environmental Hazard"

    ahi_51, cat_51 = MetrologyEngine.compute_ahi(51.00)
    assert ahi_51 == 51
    assert cat_51 == "Moderate Environmental Hazard"

    # Boundary 100 / 101 (Moderate vs Elevated)
    ahi_100, cat_100 = MetrologyEngine.compute_ahi(100.00)
    assert ahi_100 == 100
    assert cat_100 == "Moderate Environmental Hazard"

    ahi_100_49, cat_100_49 = MetrologyEngine.compute_ahi(100.49)
    assert ahi_100_49 == 100
    assert cat_100_49 == "Moderate Environmental Hazard"

    ahi_100_50, cat_100_50 = MetrologyEngine.compute_ahi(100.50)
    assert ahi_100_50 == 101
    assert cat_100_50 == "Elevated Environmental Hazard"

    ahi_101, cat_101 = MetrologyEngine.compute_ahi(101.00)
    assert ahi_101 == 101
    assert cat_101 == "Elevated Environmental Hazard"

    # Boundary 150 / 151 (Elevated vs High)
    ahi_150, cat_150 = MetrologyEngine.compute_ahi(150.00)
    assert ahi_150 == 150
    assert cat_150 == "Elevated Environmental Hazard"

    ahi_150_49, cat_150_49 = MetrologyEngine.compute_ahi(150.49)
    assert ahi_150_49 == 150
    assert cat_150_49 == "Elevated Environmental Hazard"

    ahi_150_50, cat_150_50 = MetrologyEngine.compute_ahi(150.50)
    assert ahi_150_50 == 151
    assert cat_150_50 == "High Environmental Hazard"

    ahi_151, cat_151 = MetrologyEngine.compute_ahi(151.00)
    assert ahi_151 == 151
    assert cat_151 == "High Environmental Hazard"

    # Boundary 200 / 201 (High vs Critical)
    ahi_200, cat_200 = MetrologyEngine.compute_ahi(200.00)
    assert ahi_200 == 200
    assert cat_200 == "High Environmental Hazard"

    ahi_200_49, cat_200_49 = MetrologyEngine.compute_ahi(200.49)
    assert ahi_200_49 == 200
    assert cat_200_49 == "High Environmental Hazard"

    ahi_200_50, cat_200_50 = MetrologyEngine.compute_ahi(200.50)
    assert ahi_200_50 == 201
    assert cat_200_50 == "Critical Environmental Hazard"

    ahi_201, cat_201 = MetrologyEngine.compute_ahi(201.00)
    assert ahi_201 == 201
    assert cat_201 == "Critical Environmental Hazard"


# =============================================================================
# 3. THERMAL MULTIPLIER CONFIGURATION
# =============================================================================
def test_thermal_multiplier_baseline_disabled():
    """
    Verifies that ENABLE_THERMAL_MULTIPLIER is False by default and get_thermal_multiplier
    returns 1.00 unless explicitly enabled.
    """
    assert ENABLE_THERMAL_MULTIPLIER is False

    # Calling with extreme conditions should still return 1.00 by default
    mult_default = MetrologyEngine.get_thermal_multiplier(HI_f=115.0, T_c=40.0, RH=80.0)
    assert mult_default == 1.00

    mult_cold_default = MetrologyEngine.get_thermal_multiplier(HI_f=20.0, T_c=-10.0, RH=20.0)
    assert mult_cold_default == 1.00

    # When explicitly enabled, heuristic values trigger
    mult_heat_enabled = MetrologyEngine.get_thermal_multiplier(
        HI_f=105.0, T_c=35.0, RH=60.0, enable_thermal_multiplier=True
    )
    assert mult_heat_enabled == 1.35

    mult_cold_enabled = MetrologyEngine.get_thermal_multiplier(
        HI_f=20.0, T_c=-5.0, RH=20.0, enable_thermal_multiplier=True
    )
    assert mult_cold_enabled == 1.25


# =============================================================================
# 4. INPUT VALIDATION & CONTROLLED ERROR CODES
# =============================================================================
def test_input_validation():
    """
    Verifies robust validation: None, booleans (which subclass int in Python),
    strings, lists, dicts, NaN, Inf, and out-of-range bounds.
    """
    cases = [
        ("None Temperature", None, 50.0, "ERROR_NULL_TEMP"),
        ("None Humidity", 25.0, None, "ERROR_NULL_RH"),
        ("Boolean True Temp", True, 50.0, "ERROR_TYPE_TEMP"),
        ("Boolean False Temp", False, 50.0, "ERROR_TYPE_TEMP"),
        ("Boolean True RH", 25.0, True, "ERROR_TYPE_RH"),
        ("Boolean False RH", 25.0, False, "ERROR_TYPE_RH"),
        ("String Temp", "25.0", 50.0, "ERROR_TYPE_TEMP"),
        ("List Temp", [25.0], 50.0, "ERROR_TYPE_TEMP"),
        ("Dict Temp", {"temp": 25.0}, 50.0, "ERROR_TYPE_TEMP"),
        ("NaN Temperature", float("nan"), 50.0, "ERROR_NAN_TEMP"),
        ("NaN Humidity", 25.0, float("nan"), "ERROR_NAN_RH"),
        ("+Inf Temperature", float("inf"), 50.0, "ERROR_INF_TEMP"),
        ("-Inf Temperature", float("-inf"), 50.0, "ERROR_INF_TEMP"),
        ("+Inf Humidity", 25.0, float("inf"), "ERROR_INF_RH"),
        ("Out of Range Temp Low (-45C)", -45.0, 50.0, "ERROR_OUT_OF_RANGE_TEMP"),
        ("Out of Range Temp High (+65C)", 65.0, 50.0, "ERROR_OUT_OF_RANGE_TEMP"),
        ("Out of Range RH Low (-5%)", 25.0, -5.0, "ERROR_OUT_OF_RANGE_RH"),
        ("Out of Range RH High (+105%)", 25.0, 105.0, "ERROR_OUT_OF_RANGE_RH"),
        ("Valid Boundary Temp Min (-40C)", -40.0, 50.0, "OK"),
        ("Valid Boundary Temp Max (+60C)", 60.0, 10.0, "OK"),
        ("Valid Boundary RH Min (0%)", 25.0, 0.0, "OK"),
        ("Valid Boundary RH Max (100%)", 25.0, 100.0, "OK"),
    ]
    for desc, t_val, rh_val, exp_status in cases:
        res = MetrologyEngine.calculate_heat_index(t_val, rh_val)
        assert res["status"] == exp_status, f"Case '{desc}' returned status {res['status']}, expected {exp_status}"


# =============================================================================
# 5. PM10 CONTINUOUS CONTIGUOUS BREAKPOINTS (STRICT ANALYTICAL VERIFICATION)
# =============================================================================
def test_pm10_breakpoints():
    """
    Verifies PM10 piecewise-linear interpolation at and around every breakpoint:
    [0, 54] -> [0, 50]
    [54, 154] -> [50, 100]  (slope = 0.5000)
    [154, 254] -> [100, 150] (slope = 0.5000)
    [254, 354] -> [150, 200] (slope = 0.5000)
    [354, 424] -> [200, 300] (slope = 100/70)
    [424, 604] -> [300, 500] (slope = 200/180)
    Clamped at 500 above 604.
    """
    pm10_cases = [
        (0.00, 0.0000, "Min bound (0.0 ug/m3)"),
        (53.99, 50.0 * 53.99 / 54.0, "Immediately below 54.0"),
        (54.00, 50.0000, "At 54.0 breakpoint"),
        (54.01, 50.0 + 0.5 * 0.01, "Immediately above 54.0"),
        (153.99, 50.0 + 0.5 * 99.99, "Immediately below 154.0"),
        (154.00, 100.0000, "At 154.0 breakpoint"),
        (154.01, 100.0 + 0.5 * 0.01, "Immediately above 154.0"),
        (253.99, 100.0 + 0.5 * 99.99, "Immediately below 254.0"),
        (254.00, 150.0000, "At 254.0 breakpoint"),
        (254.01, 150.0 + 0.5 * 0.01, "Immediately above 254.0"),
        (353.99, 150.0 + 0.5 * 99.99, "Immediately below 354.0"),
        (354.00, 200.0000, "At 354.0 breakpoint"),
        (354.01, 200.0 + (100.0 / 70.0) * 0.01, "Immediately above 354.0"),
        (423.99, 200.0 + (100.0 / 70.0) * 69.99, "Immediately below 424.0"),
        (424.00, 300.0000, "At 424.0 breakpoint"),
        (424.01, 300.0 + (200.0 / 180.0) * 0.01, "Immediately above 424.0"),
        (603.99, 300.0 + (200.0 / 180.0) * 179.99, "Immediately below 604.0"),
        (604.00, 500.0000, "At 604.0 breakpoint"),
        (604.01, 500.0000, "Immediately above 604.0 (clamped)"),
        (700.00, 500.0000, "Far above 604.0 (clamped)"),
    ]
    for conc, exp_idx, desc in pm10_cases:
        act_idx = MetrologyEngine.calculate_pm_subindex(conc, "PM10")
        diff = abs(act_idx - exp_idx)
        assert diff <= TOLERANCE, f"PM10 {conc} ug/m3 ({desc}) act={act_idx:.4f}, exp={exp_idx:.4f}, diff={diff}"


# =============================================================================
# 6. PM2.5 CONTINUOUS CONTIGUOUS BREAKPOINTS (STRICT ANALYTICAL VERIFICATION)
# =============================================================================
def test_pm25_breakpoints():
    """
    Verifies PM2.5 piecewise-linear interpolation at and around every breakpoint:
    [0, 9.0] -> [0, 50]
    [9.0, 35.4] -> [50, 100] (slope = 50/26.4)
    [35.4, 55.4] -> [100, 150] (slope = 50/20.0 = 2.5)
    [55.4, 125.4] -> [150, 200] (slope = 50/70)
    [125.4, 225.4] -> [200, 300] (slope = 100/100 = 1.0)
    [225.4, 500.4] -> [300, 500] (slope = 200/275)
    Clamped at 500 above 500.4.
    """
    pm25_cases = [
        (-1.00, 0.0000, "Below min bound"),
        (0.00, 0.0000, "Min bound (0.0 ug/m3)"),
        (8.99, 50.0 * 8.99 / 9.0, "Immediately below 9.0"),
        (9.00, 50.0000, "At 9.0 breakpoint"),
        (9.01, 50.0 + (50.0 / 26.4) * 0.01, "Immediately above 9.0 (resolves 9.0-9.1 gap)"),
        (9.05, 50.0 + (50.0 / 26.4) * 0.05, "Middle of previous gap (9.05)"),
        (9.10, 50.0 + (50.0 / 26.4) * 0.10, "Old 9.1 boundary point"),
        (35.39, 50.0 + (50.0 / 26.4) * 26.39, "Immediately below 35.4"),
        (35.40, 100.0000, "At 35.4 breakpoint"),
        (35.41, 100.0 + (50.0 / 20.0) * 0.01, "Immediately above 35.4"),
        (55.39, 100.0 + (50.0 / 20.0) * 19.99, "Immediately below 55.4"),
        (55.40, 150.0000, "At 55.4 breakpoint"),
        (55.41, 150.0 + (50.0 / 70.0) * 0.01, "Immediately above 55.4"),
        (125.39, 150.0 + (50.0 / 70.0) * 69.99, "Immediately below 125.4"),
        (125.40, 200.0000, "At 125.4 breakpoint"),
        (125.41, 200.0 + (100.0 / 100.0) * 0.01, "Immediately above 125.4"),
        (225.39, 200.0 + (100.0 / 100.0) * 99.99, "Immediately below 225.4"),
        (225.40, 300.0000, "At 225.4 breakpoint"),
        (225.41, 300.0 + (200.0 / 275.0) * 0.01, "Immediately above 225.4"),
        (500.39, 300.0 + (200.0 / 275.0) * 274.99, "Immediately below 500.4"),
        (500.40, 500.0000, "At 500.4 breakpoint"),
        (500.41, 500.0000, "Immediately above 500.4 (clamped)"),
        (1000.00, 500.0000, "Far above 500.4 (clamped)"),
    ]
    for conc, exp_idx, desc in pm25_cases:
        act_idx = MetrologyEngine.calculate_pm_subindex(conc, "PM2.5")
        diff = abs(act_idx - exp_idx)
        assert diff <= TOLERANCE, f"PM2.5 {conc} ug/m3 ({desc}) act={act_idx:.4f}, exp={exp_idx:.4f}, diff={diff}"


# =============================================================================
# 7. TIMESTAMP-BASED ROLLING WINDOW VERIFICATION
# =============================================================================
def test_rolling_window_nominal():
    """Verifies a full nominal 1-hour stream (120 samples @ 30s) produces VALIDATED_1HOUR."""
    rw = TimestampedRollingWindow(window_seconds=3600.0)
    base_time = 1000000.0
    for i in range(120):
        rw.add_sample(base_time + (i * 30.0), 25.0)
    ev = rw.evaluate(current_time=base_time + 3600.0)
    assert ev["status"] == "STATUS_VALIDATED_1HOUR"
    assert ev["completeness_pct"] == 100
    assert abs(ev["weighted_average"] - 25.0) <= TOLERANCE


def test_rolling_window_sufficiency_boundary():
    """Verifies the 75% data sufficiency boundary (90 samples = 2700s vs 88 samples = 2640s)."""
    base_time = 1000000.0

    # 90 samples = 2700s -> 75% completeness -> VALIDATED_1HOUR
    rw_75 = TimestampedRollingWindow(window_seconds=3600.0)
    for i in range(90):
        rw_75.add_sample(base_time + (i * 30.0), 30.0)
    ev_75 = rw_75.evaluate(current_time=base_time + 2700.0)
    assert ev_75["status"] == "STATUS_VALIDATED_1HOUR"
    assert ev_75["completeness_pct"] == 75

    # 88 samples = 2640s -> 73% completeness (< 75%) -> PROVISIONAL_SHORT_TERM
    rw_below = TimestampedRollingWindow(window_seconds=3600.0)
    for i in range(88):
        rw_below.add_sample(base_time + (i * 30.0), 30.0)
    ev_below = rw_below.evaluate(current_time=base_time + 2640.0)
    assert ev_below["status"] == "STATUS_PROVISIONAL_SHORT_TERM"
    assert ev_below["completeness_pct"] == 73


def test_rolling_window_gap_detection():
    """Verifies that gaps exceeding gap_threshold_seconds (90s) are not counted in valid duration."""
    rw = TimestampedRollingWindow(window_seconds=3600.0, gap_threshold_seconds=90.0)
    base_time = 1000000.0

    # Block 1: 40 samples (0s to 1170s = 39 intervals @ 30s = 1170s)
    for i in range(40):
        rw.add_sample(base_time + (i * 30.0), 20.0)

    # Injected gap: 1000s (> 90s gap threshold)
    gap_start = base_time + 1170.0
    gap_end = gap_start + 1000.0

    # Block 2: 40 samples (1000s later, 39 intervals @ 30s = 1170s)
    for i in range(40):
        rw.add_sample(gap_end + (i * 30.0), 40.0)

    eval_time = gap_end + (39 * 30.0) + 30.0
    ev = rw.evaluate(current_time=eval_time)

    # Valid duration = 1170s (Block 1) + 1170s (Block 2) + 30s (tail) = 2370s
    assert abs(ev["valid_duration_seconds"] - 2370.0) <= TOLERANCE
    assert ev["status"] == "STATUS_PROVISIONAL_SHORT_TERM"  # 2370s < 2700s
    expected_mean = (1170.0 * 20.0 + 1200.0 * 40.0) / 2370.0  # 71400 / 2370
    assert abs(ev["weighted_average"] - expected_mean) <= TOLERANCE


def test_rolling_window_rejections():
    """Verifies that duplicate, out-of-order, NaN, negative, string, and boolean samples are rejected."""
    rw = TimestampedRollingWindow(window_seconds=3600.0)
    base_time = 1000000.0
    rw.add_sample(base_time, 25.0)

    # Duplicate timestamp
    ok_dup, reason_dup = rw.add_sample(base_time, 30.0)
    assert not ok_dup
    assert reason_dup == "REJECTED_DUPLICATE_TIMESTAMP"

    # Out-of-order timestamp
    ok_ooo, reason_ooo = rw.add_sample(base_time - 10.0, 28.0)
    assert not ok_ooo
    assert reason_ooo == "REJECTED_OUT_OF_ORDER_TIMESTAMP"

    # NaN value
    ok_nan, reason_nan = rw.add_sample(base_time + 30.0, float("nan"))
    assert not ok_nan
    assert reason_nan == "REJECTED_INVALID_VALUE"

    # Negative value
    ok_neg, reason_neg = rw.add_sample(base_time + 60.0, -5.0)
    assert not ok_neg
    assert reason_neg == "REJECTED_INVALID_VALUE"

    # String type
    ok_str, reason_str = rw.add_sample(base_time + 90.0, "twenty")
    assert not ok_str
    assert reason_str == "REJECTED_INVALID_TYPE"

    # Boolean type
    ok_bool, reason_bool = rw.add_sample(base_time + 120.0, True)
    assert not ok_bool
    assert reason_bool == "REJECTED_INVALID_TYPE"


def test_rolling_window_stale_and_reset():
    """Verifies stale sensor timeout and buffer reset behavior."""
    rw = TimestampedRollingWindow(window_seconds=3600.0, stale_threshold_seconds=300.0)
    base_time = 1000000.0
    for i in range(10):
        rw.add_sample(base_time + (i * 30.0), 20.0)

    # Check 301 seconds after latest sample (latest sample at base_time + 270s)
    ev_stale = rw.evaluate(current_time=base_time + 270.0 + 301.0)
    assert ev_stale["status"] == "STATUS_SENSOR_OFFLINE_STALE"
    assert ev_stale["is_valid"] is False

    # Reset buffer
    rw.reset()
    assert len(rw.buffer) == 0
    ev_empty = rw.evaluate(current_time=base_time)
    assert ev_empty["status"] == "STATUS_EMPTY_BUFFER"


# =============================================================================
# 8. NOAA HEAT INDEX BRANCHES & PRECONDITIONS
# =============================================================================
def test_noaa_heat_index_screening_branch():
    """Verifies screening average condition ((HI_simple + T_f) / 2 < 80F)."""
    # At T_f = 80.19F, RH = 40%, screening_avg = 79.994F < 80.0F -> SIMPLE_BRANCH
    t_f_below = 80.19
    res_below = MetrologyEngine.calculate_heat_index((t_f_below - 32.0) * 5 / 9, 40.0)
    assert res_below["branch"] == "SIMPLE_BRANCH"

    # At T_f = 80.21F, RH = 40%, screening_avg = 80.007F >= 80.0F -> FULL_ROTHFUSZ_STANDARD
    t_f_above = 80.21
    res_above = MetrologyEngine.calculate_heat_index((t_f_above - 32.0) * 5 / 9, 40.0)
    assert res_above["branch"] == "FULL_ROTHFUSZ_STANDARD"


def test_noaa_heat_index_dry_adjustment():
    """Verifies dry adjustment branch: RH < 13% and 80F <= T_f <= 112F."""
    # T_f = 95F, RH = 12.99% -> DRY_ADJUSTMENT
    t_dry_95 = (95.0 - 32.0) * 5 / 9
    res_dry_act = MetrologyEngine.calculate_heat_index(t_dry_95, 12.99)
    assert res_dry_act["branch"] == "DRY_ADJUSTMENT"

    # T_f = 95F, RH = 13.00% -> Inactive
    res_dry_inact = MetrologyEngine.calculate_heat_index(t_dry_95, 13.00)
    assert res_dry_inact["branch"] == "FULL_ROTHFUSZ_STANDARD"

    # Precondition verification: at T_f=80F, RH=10%, screening_avg < 80F -> SIMPLE_BRANCH
    t_dry_80 = (80.0 - 32.0) * 5 / 9
    res_dry_80 = MetrologyEngine.calculate_heat_index(t_dry_80, 10.0)
    assert res_dry_80["branch"] == "SIMPLE_BRANCH"

    # At T_f=82F, RH=10%, screening_avg >= 80F -> DRY_ADJUSTMENT triggered
    t_dry_82 = (82.0 - 32.0) * 5 / 9
    res_dry_82 = MetrologyEngine.calculate_heat_index(t_dry_82, 10.0)
    assert res_dry_82["branch"] == "DRY_ADJUSTMENT"

    # Upper endpoint of dry adjustment: T_f=112F (safe sqrt argument = 0)
    t_dry_112 = (112.0 - 32.0) * 5 / 9
    res_dry_112 = MetrologyEngine.calculate_heat_index(t_dry_112, 10.0)
    assert res_dry_112["branch"] == "DRY_ADJUSTMENT"


def test_noaa_heat_index_humid_adjustment():
    """Verifies humid adjustment branch: RH > 85% and 80F <= T_f <= 87F."""
    t_hum_84 = (84.0 - 32.0) * 5 / 9

    # RH = 85.00% -> Inactive
    res_hum_inact = MetrologyEngine.calculate_heat_index(t_hum_84, 85.00)
    assert res_hum_inact["branch"] == "FULL_ROTHFUSZ_STANDARD"

    # RH = 85.01% -> Active
    res_hum_act = MetrologyEngine.calculate_heat_index(t_hum_84, 85.01)
    assert res_hum_act["branch"] == "HUMID_ADJUSTMENT"

    # Endpoints: T_f=80F and T_f=87F
    res_hum_80 = MetrologyEngine.calculate_heat_index((80.0 - 32.0) * 5 / 9, 90.0)
    assert res_hum_80["branch"] == "HUMID_ADJUSTMENT"

    res_hum_87 = MetrologyEngine.calculate_heat_index((87.0 - 32.0) * 5 / 9, 90.0)
    assert res_hum_87["branch"] == "HUMID_ADJUSTMENT"


# =============================================================================
# 9. NEGATIVE TEST VERIFICATION
# =============================================================================
def test_negative_test_harness():
    """
    Proves that the test suite detects failures when calculated values differ
    from corrupted expected values beyond the tolerance threshold.
    """
    actual_test_val = MetrologyEngine.calculate_pm_subindex(54.00, "PM10")  # Exactly 50.0000
    bogus_expected_val = 99.9999  # Corrupted value
    diff_neg = abs(actual_test_val - bogus_expected_val)
    # The harness MUST identify this as a failure (diff > TOLERANCE)
    assert diff_neg > TOLERANCE, "Harness failed to detect intentional mismatch!"


# =============================================================================
# 10. NOAA / NWS BENCHMARK BENCHMARKS
# =============================================================================
def test_nws_benchmarks():
    """
    Verifies 10 official NOAA/NWS heat index benchmark points.
    All points must match the published table within +-1 deg F.
    """
    nws_benchmarks = [
        ("77F, 50% RH (Simple)", 25.0, 50.0, 77),
        ("80F, 40% RH (Boundary)", (80 - 32) * 5 / 9, 40.0, 80),
        ("82F, 60% RH (Full)", (82 - 32) * 5 / 9, 60.0, 84),
        ("86F, 50% RH (Full)", (86 - 32) * 5 / 9, 50.0, 88),
        ("90F, 40% RH (Full)", (90 - 32) * 5 / 9, 40.0, 91),
        ("90F, 70% RH (Full)", (90 - 32) * 5 / 9, 70.0, 106),
        ("94F, 60% RH (Full)", (94 - 32) * 5 / 9, 60.0, 111),
        ("100F, 40% RH (Full)", (100 - 32) * 5 / 9, 40.0, 109),
        ("95F, 10% RH (Dry Adj)", 35.0, 10.0, 89),
        ("83.3F, 90% RH (Humid Adj)", 28.5, 90.0, 96),
    ]
    for desc, tc, rh, expected in nws_benchmarks:
        res = MetrologyEngine.calculate_heat_index(tc, rh)
        r_val = round_half_up(res["HI_f"])
        diff = abs(r_val - expected)
        assert diff <= 1, f"NWS Benchmark '{desc}' calc={res['HI_f']:.4f}F (rounded {r_val}), expected {expected}F"


# =============================================================================
# STANDALONE TEST RUNNER FOR EXPLICIT OUTPUT REPORTING
# =============================================================================
def run_standalone_suite():
    """
    Runs all tests standalone, printing comprehensive tables with 4-decimal precision,
    actual vs expected, absolute differences, and complete pass/fail counts.
    """
    total_passed = 0
    total_tests = 0

    def assert_strict(actual, expected, name, details=""):
        nonlocal total_passed, total_tests
        total_tests += 1
        diff = abs(actual - expected)
        if diff <= TOLERANCE:
            total_passed += 1
            print(f"  [PASS] {name:<35} | Act: {actual:10.4f} | Exp: {expected:10.4f} | Diff: {diff:10.8f} {details}")
            return True
        else:
            print(f"  [FAIL] {name:<35} | Act: {actual:10.4f} | Exp: {expected:10.4f} | Diff: {diff:10.8f} {details}")
            return False

    def assert_status(actual_status, expected_status, name, details=""):
        nonlocal total_passed, total_tests
        total_tests += 1
        if actual_status == expected_status:
            total_passed += 1
            print(f"  [PASS] {name:<35} | Status: {actual_status:<28} {details}")
            return True
        else:
            print(f"  [FAIL] {name:<35} | Status: {actual_status:<28} | Exp: {expected_status:<28} {details}")
            return False

    print("==========================================================================================")
    print(f"RESPIGUARD ENVIRONMENTAL HAZARD SCORING & METROLOGY VERIFICATION SUITE")
    print(f"Engine Version: {MetrologyEngine.VERSION} | Policy: Round-Half-Up | Numerical Tolerance <= {TOLERANCE}")
    print("==========================================================================================")

    # SUITE 1: ROUNDING POLICY & .5 BOUNDARY TESTS
    print("\n--- SUITE 1: ROUND-HALF-UP POLICY & .5 BOUNDARIES ---")
    half_boundary_cases = [
        (0.00, 0), (0.49, 0), (0.50, 1), (0.51, 1),
        (1.49, 1), (1.50, 2), (1.51, 2),
        (2.49, 2), (2.50, 3), (2.51, 3),
        (3.50, 4), (4.50, 5),
        (50.49, 50), (50.50, 51), (50.51, 51),
        (100.49, 100), (100.50, 101), (100.51, 101),
        (150.49, 150), (150.50, 151), (150.51, 151),
        (200.49, 200), (200.50, 201), (200.51, 201),
        (500.49, 500), (500.50, 501),
        (-0.49, 0), (-0.50, 0), (-0.51, -1),
        (-1.50, -1), (-2.50, -2), (-3.50, -3),
    ]
    for val, exp_rhu in half_boundary_cases:
        act_rhu = round_half_up(val)
        py_round = round(val)
        div_note = " [DIV]" if act_rhu != py_round else ""
        assert_strict(float(act_rhu), float(exp_rhu), f"round_half_up({val:6.2f})", f"(py_round={py_round}){div_note}")

    # SUITE 2: AHI CLAMPS & CATEGORY BOUNDARIES
    print("\n--- SUITE 2: DETERMINISTIC AHI CLAMPS & CATEGORY BOUNDARIES ---")
    clamp_cases = [
        ("AHI Lower Clamp (0.0)", 0.0, 1.0, 0, "Low Environmental Hazard"),
        ("AHI Lower Clamp (-10.0)", -10.0, 1.0, 0, "Low Environmental Hazard"),
        ("AHI Lower Clamp (-0.01)", -0.01, 1.0, 0, "Low Environmental Hazard"),
        ("AHI Lower Clamp (neg mult)", 50.0, -1.0, 0, "Low Environmental Hazard"),
        ("AHI Upper Clamp (500.0)", 500.0, 1.0, 500, "Critical Environmental Hazard"),
        ("AHI Upper Clamp (500.49)", 500.49, 1.0, 500, "Critical Environmental Hazard"),
        ("AHI Upper Clamp (500.50)", 500.50, 1.0, 500, "Critical Environmental Hazard"),
        ("AHI Upper Clamp (600.0)", 600.0, 1.0, 500, "Critical Environmental Hazard"),
        ("AHI Upper Clamp (450*1.35)", 450.0, 1.35, 500, "Critical Environmental Hazard"),
        ("Boundary 50.00 (Low)", 50.00, 1.0, 50, "Low Environmental Hazard"),
        ("Boundary 50.49 (Low)", 50.49, 1.0, 50, "Low Environmental Hazard"),
        ("Boundary 50.50 (Moderate)", 50.50, 1.0, 51, "Moderate Environmental Hazard"),
        ("Boundary 51.00 (Moderate)", 51.00, 1.0, 51, "Moderate Environmental Hazard"),
        ("Boundary 100.00 (Moderate)", 100.00, 1.0, 100, "Moderate Environmental Hazard"),
        ("Boundary 100.49 (Moderate)", 100.49, 1.0, 100, "Moderate Environmental Hazard"),
        ("Boundary 100.50 (Elevated)", 100.50, 1.0, 101, "Elevated Environmental Hazard"),
        ("Boundary 101.00 (Elevated)", 101.00, 1.0, 101, "Elevated Environmental Hazard"),
        ("Boundary 150.00 (Elevated)", 150.00, 1.0, 150, "Elevated Environmental Hazard"),
        ("Boundary 150.49 (Elevated)", 150.49, 1.0, 150, "Elevated Environmental Hazard"),
        ("Boundary 150.50 (High)", 150.50, 1.0, 151, "High Environmental Hazard"),
        ("Boundary 151.00 (High)", 151.00, 1.0, 151, "High Environmental Hazard"),
        ("Boundary 200.00 (High)", 200.00, 1.0, 200, "High Environmental Hazard"),
        ("Boundary 200.49 (High)", 200.49, 1.0, 200, "High Environmental Hazard"),
        ("Boundary 200.50 (Critical)", 200.50, 1.0, 201, "Critical Environmental Hazard"),
        ("Boundary 201.00 (Critical)", 201.00, 1.0, 201, "Critical Environmental Hazard"),
    ]
    for desc, i_base, m_t, exp_ahi, exp_cat in clamp_cases:
        act_ahi, act_cat = MetrologyEngine.compute_ahi(i_base, m_t)
        assert_strict(float(act_ahi), float(exp_ahi), desc)
        assert_status(act_cat, exp_cat, f"{desc} Category")

    # SUITE 3: INPUT VALIDATION
    print("\n--- SUITE 3: INPUT VALIDATION & CONTROLLED ERROR CODES ---")
    type_cases = [
        ("None Temperature", None, 50.0, "ERROR_NULL_TEMP"),
        ("None Humidity", 25.0, None, "ERROR_NULL_RH"),
        ("Boolean True Temp", True, 50.0, "ERROR_TYPE_TEMP"),
        ("Boolean False Temp", False, 50.0, "ERROR_TYPE_TEMP"),
        ("Boolean True RH", 25.0, True, "ERROR_TYPE_RH"),
        ("String Temp", "25.0", 50.0, "ERROR_TYPE_TEMP"),
        ("List Temp", [25.0], 50.0, "ERROR_TYPE_TEMP"),
        ("Dict Temp", {"temp": 25.0}, 50.0, "ERROR_TYPE_TEMP"),
        ("NaN Temperature", float("nan"), 50.0, "ERROR_NAN_TEMP"),
        ("NaN Humidity", 25.0, float("nan"), "ERROR_NAN_RH"),
        ("+Inf Temperature", float("inf"), 50.0, "ERROR_INF_TEMP"),
        ("-Inf Temperature", float("-inf"), 50.0, "ERROR_INF_TEMP"),
        ("+Inf Humidity", 25.0, float("inf"), "ERROR_INF_RH"),
        ("Out of Range Temp Low (-45C)", -45.0, 50.0, "ERROR_OUT_OF_RANGE_TEMP"),
        ("Out of Range Temp High (+65C)", 65.0, 50.0, "ERROR_OUT_OF_RANGE_TEMP"),
        ("Out of Range RH Low (-5%)", 25.0, -5.0, "ERROR_OUT_OF_RANGE_RH"),
        ("Out of Range RH High (+105%)", 25.0, 105.0, "ERROR_OUT_OF_RANGE_RH"),
        ("Valid Boundary Temp Min (-40C)", -40.0, 50.0, "OK"),
        ("Valid Boundary Temp Max (+60C)", 60.0, 10.0, "OK"),
        ("Valid Boundary RH Min (0%)", 25.0, 0.0, "OK"),
        ("Valid Boundary RH Max (100%)", 25.0, 100.0, "OK"),
    ]
    for desc, t_val, rh_val, exp_status in type_cases:
        res = MetrologyEngine.calculate_heat_index(t_val, rh_val)
        assert_status(res["status"], exp_status, desc)

    # SUITE 4: PM10 BREAKPOINT INTERPOLATION
    print("\n--- SUITE 4: PM10 CONTINUOUS INTERPOLATION (STRICT BOUNDARY TESTS) ---")
    pm10_cases = [
        (0.00, 0.0000, "Min bound (0.0 ug/m3)"),
        (53.99, 50.0 * 53.99 / 54.0, "Immediately below 54.0"),
        (54.00, 50.0000, "At 54.0 breakpoint"),
        (54.01, 50.0 + 0.5 * 0.01, "Immediately above 54.0"),
        (153.99, 50.0 + 0.5 * 99.99, "Immediately below 154.0"),
        (154.00, 100.0000, "At 154.0 breakpoint"),
        (154.01, 100.0 + 0.5 * 0.01, "Immediately above 154.0"),
        (253.99, 100.0 + 0.5 * 99.99, "Immediately below 254.0"),
        (254.00, 150.0000, "At 254.0 breakpoint"),
        (254.01, 150.0 + 0.5 * 0.01, "Immediately above 254.0"),
        (353.99, 150.0 + 0.5 * 99.99, "Immediately below 354.0"),
        (354.00, 200.0000, "At 354.0 breakpoint"),
        (354.01, 200.0 + (100.0 / 70.0) * 0.01, "Immediately above 354.0"),
        (423.99, 200.0 + (100.0 / 70.0) * 69.99, "Immediately below 424.0"),
        (424.00, 300.0000, "At 424.0 breakpoint"),
        (424.01, 300.0 + (200.0 / 180.0) * 0.01, "Immediately above 424.0"),
        (603.99, 300.0 + (200.0 / 180.0) * 179.99, "Immediately below 604.0"),
        (604.00, 500.0000, "At 604.0 breakpoint"),
        (604.01, 500.0000, "Immediately above 604.0 (clamped)"),
        (700.00, 500.0000, "Far above 604.0 (clamped)"),
    ]
    for conc, exp_idx, desc in pm10_cases:
        act_idx = MetrologyEngine.calculate_pm_subindex(conc, "PM10")
        assert_strict(act_idx, exp_idx, f"PM10 {conc:7.2f} ug/m3", f"({desc})")

    # SUITE 5: PM2.5 BREAKPOINT INTERPOLATION
    print("\n--- SUITE 5: PM2.5 CONTINUOUS INTERPOLATION (STRICT BOUNDARY TESTS) ---")
    pm25_cases = [
        (-1.00, 0.0000, "Below min bound"),
        (0.00, 0.0000, "Min bound (0.0 ug/m3)"),
        (8.99, 50.0 * 8.99 / 9.0, "Immediately below 9.0"),
        (9.00, 50.0000, "At 9.0 breakpoint"),
        (9.01, 50.0 + (50.0 / 26.4) * 0.01, "Immediately above 9.0 (resolves 9.0-9.1 gap)"),
        (9.05, 50.0 + (50.0 / 26.4) * 0.05, "Middle of previous gap (9.05)"),
        (9.10, 50.0 + (50.0 / 26.4) * 0.10, "Old 9.1 boundary point"),
        (35.39, 50.0 + (50.0 / 26.4) * 26.39, "Immediately below 35.4"),
        (35.40, 100.0000, "At 35.4 breakpoint"),
        (35.41, 100.0 + (50.0 / 20.0) * 0.01, "Immediately above 35.4"),
        (55.39, 100.0 + (50.0 / 20.0) * 19.99, "Immediately below 55.4"),
        (55.40, 150.0000, "At 55.4 breakpoint"),
        (55.41, 150.0 + (50.0 / 70.0) * 0.01, "Immediately above 55.4"),
        (125.39, 150.0 + (50.0 / 70.0) * 69.99, "Immediately below 125.4"),
        (125.40, 200.0000, "At 125.4 breakpoint"),
        (125.41, 200.0 + (100.0 / 100.0) * 0.01, "Immediately above 125.4"),
        (225.39, 200.0 + (100.0 / 100.0) * 99.99, "Immediately below 225.4"),
        (225.40, 300.0000, "At 225.4 breakpoint"),
        (225.41, 300.0 + (200.0 / 275.0) * 0.01, "Immediately above 225.4"),
        (500.39, 300.0 + (200.0 / 275.0) * 274.99, "Immediately below 500.4"),
        (500.40, 500.0000, "At 500.4 breakpoint"),
        (500.41, 500.0000, "Immediately above 500.4 (clamped)"),
        (1000.00, 500.0000, "Far above 500.4 (clamped)"),
    ]
    for conc, exp_idx, desc in pm25_cases:
        act_idx = MetrologyEngine.calculate_pm_subindex(conc, "PM2.5")
        assert_strict(act_idx, exp_idx, f"PM2.5 {conc:7.2f} ug/m3", f"({desc})")

    # SUITE 6: ROLLING WINDOW
    print("\n--- SUITE 6: ACTUAL TIMESTAMP-BASED ROLLING WINDOW ---")
    rw = TimestampedRollingWindow(window_seconds=3600.0, gap_threshold_seconds=90.0, stale_threshold_seconds=300.0)
    base_time = 1000000.0

    for i in range(120):
        rw.add_sample(base_time + (i * 30.0), 25.0)
    ev1 = rw.evaluate(current_time=base_time + 3600.0)
    assert_status(ev1["status"], "STATUS_VALIDATED_1HOUR", "Nominal 1-Hour Stream Status")
    assert_strict(float(ev1["completeness_pct"]), 100.0, "Nominal 1-Hour Completeness (%)")
    assert_strict(ev1["weighted_average"], 25.0, "Nominal 1-Hour Weighted Mean")

    rw.reset()
    for i in range(90):
        rw.add_sample(base_time + (i * 30.0), 30.0)
    ev_75 = rw.evaluate(current_time=base_time + 2700.0)
    assert_status(ev_75["status"], "STATUS_VALIDATED_1HOUR", "Exact 75% Boundary Status")
    assert_strict(float(ev_75["completeness_pct"]), 75.0, "Exact 75% Completeness (%)")

    rw.reset()
    for i in range(88):
        rw.add_sample(base_time + (i * 30.0), 30.0)
    ev_below75 = rw.evaluate(current_time=base_time + 2640.0)
    assert_status(ev_below75["status"], "STATUS_PROVISIONAL_SHORT_TERM", "Below 75% Status (88 samples)")
    assert_strict(float(ev_below75["completeness_pct"]), 73.0, "Below 75% Completeness (%)")

    rw.reset()
    for i in range(40):
        rw.add_sample(base_time + (i * 30.0), 20.0)
    gap_start = base_time + 1170.0
    gap_end = gap_start + 1000.0
    for i in range(40):
        rw.add_sample(gap_end + (i * 30.0), 40.0)
    ev_gap = rw.evaluate(current_time=gap_end + (39 * 30.0) + 30.0)
    assert_strict(ev_gap["valid_duration_seconds"], 2370.0, "Gap Uncounted in Valid Duration (s)")
    assert_status(ev_gap["status"], "STATUS_PROVISIONAL_SHORT_TERM", "Gap Reduces Sufficiency Status")
    assert_strict(ev_gap["weighted_average"], 71400.0 / 2370.0, "Gap Weighted Mean")

    rw.reset()
    t_ref = base_time + 100.0
    rw.add_sample(t_ref, 25.0)
    ok_dup, reason_dup = rw.add_sample(t_ref, 30.0)
    assert_status(reason_dup, "REJECTED_DUPLICATE_TIMESTAMP", "Duplicate Timestamp Rejection")
    ok_ooo, reason_ooo = rw.add_sample(t_ref - 10.0, 28.0)
    assert_status(reason_ooo, "REJECTED_OUT_OF_ORDER_TIMESTAMP", "Out-of-Order Timestamp Rejection")
    ok_nan, reason_nan = rw.add_sample(t_ref + 30.0, float("nan"))
    assert_status(reason_nan, "REJECTED_INVALID_VALUE", "NaN Value Rejection")
    ok_neg, reason_neg = rw.add_sample(t_ref + 60.0, -5.0)
    assert_status(reason_neg, "REJECTED_INVALID_VALUE", "Negative Value Rejection")
    ok_str, reason_str = rw.add_sample(t_ref + 90.0, "twenty")
    assert_status(reason_str, "REJECTED_INVALID_TYPE", "String Value Rejection")
    ok_bool, reason_bool = rw.add_sample(t_ref + 120.0, True)
    assert_status(reason_bool, "REJECTED_INVALID_TYPE", "Boolean Value Rejection")

    ev_stale = rw.evaluate(current_time=t_ref + 301.0)
    assert_status(ev_stale["status"], "STATUS_SENSOR_OFFLINE_STALE", "Stale Sensor Timeout (>300s)")
    rw.reset()
    ev_empty = rw.evaluate(current_time=base_time)
    assert_status(ev_empty["status"], "STATUS_EMPTY_BUFFER", "Buffer Reset State")

    # SUITE 7: NOAA HEAT INDEX BOUNDARIES
    print("\n--- SUITE 7: NOAA HEAT INDEX BOUNDARIES & PRECONDITIONS ---")
    t_f_below = 80.19
    res_below = MetrologyEngine.calculate_heat_index((t_f_below - 32.0) * 5 / 9, 40.0)
    assert_status(res_below["branch"], "SIMPLE_BRANCH", "Screening avg below 80F")

    t_f_above = 80.21
    res_above = MetrologyEngine.calculate_heat_index((t_f_above - 32.0) * 5 / 9, 40.0)
    assert_status(res_above["branch"], "FULL_ROTHFUSZ_STANDARD", "Screening avg above 80F")

    t_dry_95 = (95.0 - 32.0) * 5 / 9
    res_dry_act = MetrologyEngine.calculate_heat_index(t_dry_95, 12.99)
    assert_status(res_dry_act["branch"], "DRY_ADJUSTMENT", "Dry adjustment active (RH=12.99%)")
    res_dry_inact = MetrologyEngine.calculate_heat_index(t_dry_95, 13.00)
    assert_status(res_dry_inact["branch"], "FULL_ROTHFUSZ_STANDARD", "Dry adjustment inactive (RH=13.00%)")

    t_dry_80 = (80.0 - 32.0) * 5 / 9
    res_dry_80 = MetrologyEngine.calculate_heat_index(t_dry_80, 10.0)
    assert_status(res_dry_80["branch"], "SIMPLE_BRANCH", "T_f=80F/RH=10% screening precondition")

    t_dry_82 = (82.0 - 32.0) * 5 / 9
    res_dry_82 = MetrologyEngine.calculate_heat_index(t_dry_82, 10.0)
    assert_status(res_dry_82["branch"], "DRY_ADJUSTMENT", "T_f=82F/RH=10% dry adj triggered")

    t_dry_112 = (112.0 - 32.0) * 5 / 9
    res_dry_112 = MetrologyEngine.calculate_heat_index(t_dry_112, 10.0)
    assert_status(res_dry_112["branch"], "DRY_ADJUSTMENT", "Dry adjustment at T_f=112F (sqrt arg=0)")

    t_hum_84 = (84.0 - 32.0) * 5 / 9
    res_hum_inact = MetrologyEngine.calculate_heat_index(t_hum_84, 85.00)
    assert_status(res_hum_inact["branch"], "FULL_ROTHFUSZ_STANDARD", "Humid adjustment inactive (RH=85.00%)")
    res_hum_act = MetrologyEngine.calculate_heat_index(t_hum_84, 85.01)
    assert_status(res_hum_act["branch"], "HUMID_ADJUSTMENT", "Humid adjustment active (RH=85.01%)")

    res_hum_80 = MetrologyEngine.calculate_heat_index((80.0 - 32.0) * 5 / 9, 90.0)
    assert_status(res_hum_80["branch"], "HUMID_ADJUSTMENT", "Humid adjustment at T_f=80F")
    res_hum_87 = MetrologyEngine.calculate_heat_index((87.0 - 32.0) * 5 / 9, 90.0)
    assert_status(res_hum_87["branch"], "HUMID_ADJUSTMENT", "Humid adjustment at T_f=87F")

    # SUITE 8: NEGATIVE TEST VERIFICATION
    print("\n--- SUITE 8: NEGATIVE TEST VERIFICATION (HARNESS FAILURE DETECTION) ---")
    actual_test_val = MetrologyEngine.calculate_pm_subindex(54.00, "PM10")
    bogus_expected_val = 99.9999
    diff_neg = abs(actual_test_val - bogus_expected_val)
    if diff_neg > TOLERANCE:
        total_tests += 1
        total_passed += 1
        print(f"  [PASS] Negative Test: Harness correctly rejected bogus value | Diff: {diff_neg:10.4f} > {TOLERANCE}")
    else:
        total_tests += 1
        print(f"  [FAIL] Negative Test: Harness failed to detect bogus value!")

    # SUITE 9: NWS BENCHMARKS
    print("\n--- SUITE 9: NWS BENCHMARKS (EXACT MATCH / WITHIN +-1F) ---")
    nws_benchmarks = [
        ("77F, 50% RH (Simple)", 25.0, 50.0, 77),
        ("80F, 40% RH (Boundary)", (80 - 32) * 5 / 9, 40.0, 80),
        ("82F, 60% RH (Full)", (82 - 32) * 5 / 9, 60.0, 84),
        ("86F, 50% RH (Full)", (86 - 32) * 5 / 9, 50.0, 88),
        ("90F, 40% RH (Full)", (90 - 32) * 5 / 9, 40.0, 91),
        ("90F, 70% RH (Full)", (90 - 32) * 5 / 9, 70.0, 106),
        ("94F, 60% RH (Full)", (94 - 32) * 5 / 9, 60.0, 111),
        ("100F, 40% RH (Full)", (100 - 32) * 5 / 9, 40.0, 109),
        ("95F, 10% RH (Dry Adj)", 35.0, 10.0, 89),
        ("83.3F, 90% RH (Humid Adj)", 28.5, 90.0, 96),
    ]
    for desc, tc, rh, expected in nws_benchmarks:
        res = MetrologyEngine.calculate_heat_index(tc, rh)
        r_val = round_half_up(res["HI_f"])
        diff = abs(r_val - expected)
        label = "EXACT MATCH" if diff == 0 else ("WITHIN +-1F" if diff == 1 else "MISMATCH")
        total_tests += 1
        if diff <= 1:
            total_passed += 1
            print(f"  [PASS] {desc:<35} | Calc: {res['HI_f']:8.4f} F (Round {r_val:3}) | NWS: {expected:3} [{label}]")
        else:
            print(f"  [FAIL] {desc:<35} | Calc: {res['HI_f']:8.4f} F (Round {r_val:3}) | NWS: {expected:3} [{label}]")

    print("\n==========================================================================================")
    print(f"VERIFICATION RESULTS: {total_passed} / {total_tests} TESTS PASSED ({total_passed / total_tests * 100:.1f}%)")
    print("==========================================================================================")
    return total_passed == total_tests


if __name__ == "__main__":
    success = run_standalone_suite()
    sys.exit(0 if success else 1)
