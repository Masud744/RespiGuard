"""
RespiGuard Machine Learning Pipeline: Leakage-Aware Dataset Preparation
========================================================================
Module: ml_pipeline/prepare_training_data.py

Objectives:
1. Load audited AAMOS-00 clinical dataset (datasets/generated/asthma_risk_extended.csv).
2. Exclude all target-leakage features, patient-identifying shortcuts, non-sensor metadata,
   and synthetic channels:
   - pef_ratio, pef_max, effective_pef_best (Target Leakage)
   - user_key (Patient shortcut / group identifier)
   - severity, age_range, sex (Static patient metadata / non-environmental)
   - pm1_0 (Synthesized Gaussian noise)
   - date, hour, morning, pressure, wind_speed, aqi (Unmeasured / regional)
3. Select strictly deployable, physical, directly measured onboard environmental features:
   - temperature (DHT22, °C)
   - humidity (DHT22, %)
   - pm2_5 (PMS5003, µg/m³)
   - pm10 (PMS5003, µg/m³)
4. Implement patient-wise disjoint group splitting (Train / Val / Test) to eliminate patient-level leakage.
5. Fit standard feature preprocessor strictly on training fold only.
6. Export processed train, validation, and test datasets along with metadata.
   (DOES NOT TRAIN ANY MODELS).
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INPUT_DATA_PATH = os.path.join(BASE_DIR, "datasets", "generated", "asthma_risk_extended.csv")
OUTPUT_DIR = os.path.join(BASE_DIR, "datasets", "processed")

# Selected onboard environmental features
SELECTED_FEATURES = ["temperature", "humidity", "pm2_5", "pm10"]

# Excluded features with rationale
EXCLUDED_FEATURES = {
    "pef_ratio": "Direct mathematical derivation of the target label (100% deterministic target leakage).",
    "pef_max": "Actual measured peak expiratory flow; numerator of target formula (severe target leakage).",
    "effective_pef_best": "Patient personal best peak flow; denominator of target formula (severe target leakage).",
    "user_key": "Categorical patient ID; memorizing user keys creates shortcut learning and zero generalization.",
    "severity": "Static baseline clinical category; not measured by environmental device, confounding risk.",
    "age_range": "Demographic category; static per patient, confounding risk.",
    "sex": "Demographic category; static per patient, confounding risk.",
    "pm1_0": "Synthetically generated channel in build_dataset.py using Gaussian noise; invalid ground truth.",
    "pressure": "Regional barometric pressure from external weather stations; not measured by onboard hardware.",
    "wind_speed": "Regional wind speed from external weather stations; not measured by onboard hardware.",
    "aqi": "External regional weather station AQI index; not measured by onboard hardware.",
    "date": "Study calendar day; causes spurious temporal correlations across seasonal transitions.",
    "hour": "Time-of-day indicator; prone to circadian overfitting in small cohort.",
    "morning": "Binary morning/evening indicator; prone to circadian overfitting."
}

# Target definition & clinical limitations
TARGET_DEFINITION = {
    "name": "risk_label",
    "mapping": {"Green": 0, "Yellow": 1, "Red": 2},
    "formula": "PEFR_actual / PEFR_personal_best",
    "thresholds": {
        "Green": "pef_ratio >= 0.80 (PEFR >= 80% personal best)",
        "Yellow": "0.50 <= pef_ratio < 0.80 (PEFR 50-79% personal best)",
        "Red": "pef_ratio < 0.50 (PEFR < 50% personal best)"
    },
    "major_limitations": [
        "The label is a physiological spirometry ratio, NOT an independent environmental hazard or clinical exacerbation.",
        "Low PEFR can be caused by user inhalation technique, physical fatigue, psychological stress, or circadian variation.",
        "Extreme class imbalance and patient concentration: 89 of 93 (95.7%) of all Red labels belong to Patient 190.",
        "Environmental data in AAMOS-00 was gathered from regional outdoor monitoring stations, not personal wearable dosimeters."
    ]
}

# Patient-wise disjoint group split assignment
# Disjoint sets: Zero patient overlap across Train, Val, and Test
SPLIT_PATIENTS = {
    "train": [190, 217, 294, 473, 514, 625, 702, 764, 808],  # 9 patients, accounts for 89 Red labels
    "val": [328, 447, 939],                                  # 3 patients, high Green & Yellow representation
    "test": [113, 343, 701, 867]                             # 4 patients, includes Patient 343 with 4 Red labels
}


def prepare_datasets():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print("=" * 80)
    print("RESPIGUARD LEAKAGE-AWARE DATASET PREPARATION & PREPROCESSING PIPELINE")
    print("=" * 80)

    if not os.path.exists(INPUT_DATA_PATH):
        raise FileNotFoundError(f"Input dataset not found at '{INPUT_DATA_PATH}'.")

    df = pd.read_csv(INPUT_DATA_PATH)
    total_raw_rows = len(df)
    print(f"Loaded source dataset: '{INPUT_DATA_PATH}' ({total_raw_rows:,} rows, {df.shape[1]} columns)")

    # 1. Verify that all selected features exist and have zero nulls
    missing_features = [f for f in SELECTED_FEATURES if f not in df.columns]
    if missing_features:
        raise KeyError(f"Missing expected features in source dataset: {missing_features}")

    clean_df = df.dropna(subset=SELECTED_FEATURES + ["risk_label", "user_key"]).copy()
    print(f"Clean rows after dropping any nulls in selected features/target: {len(clean_df):,}")

    # Map target label
    clean_df["risk_label_numeric"] = clean_df["risk_label"].map(TARGET_DEFINITION["mapping"])

    # 2. Patient-Wise Group Partitioning
    train_mask = clean_df["user_key"].isin(SPLIT_PATIENTS["train"])
    val_mask = clean_df["user_key"].isin(SPLIT_PATIENTS["val"])
    test_mask = clean_df["user_key"].isin(SPLIT_PATIENTS["test"])

    # Sanity checks: Mutual exclusivity & completeness
    assert (train_mask & val_mask).sum() == 0, "Patient leakage detected between Train and Val!"
    assert (train_mask & test_mask).sum() == 0, "Patient leakage detected between Train and Test!"
    assert (val_mask & test_mask).sum() == 0, "Patient leakage detected between Val and Test!"
    assert (train_mask | val_mask | test_mask).sum() == len(clean_df), "Some rows unassigned to any split!"

    train_df = clean_df[train_mask].copy()
    val_df = clean_df[val_mask].copy()
    test_df = clean_df[test_mask].copy()

    # 3. Fit Preprocessing Pipeline Strictly on Training Split
    print("\nFitting StandardScaler strictly on training set features...")
    scaler = StandardScaler()
    scaler.fit(train_df[SELECTED_FEATURES])

    # Transform features
    X_train_scaled = pd.DataFrame(scaler.transform(train_df[SELECTED_FEATURES]), columns=SELECTED_FEATURES, index=train_df.index)
    X_val_scaled = pd.DataFrame(scaler.transform(val_df[SELECTED_FEATURES]), columns=SELECTED_FEATURES, index=val_df.index)
    X_test_scaled = pd.DataFrame(scaler.transform(test_df[SELECTED_FEATURES]), columns=SELECTED_FEATURES, index=test_df.index)

    # 4. Save Fitted Preprocessor Artifact
    scaler_path = os.path.join(OUTPUT_DIR, "preprocessor.joblib")
    joblib.dump(scaler, scaler_path)
    print(f"[+] Saved fitted preprocessor: '{scaler_path}'")

    # 5. Export Datasets
    # A. Raw (unscaled) splits with user_key (for tracking) and targets
    cols_to_export = ["user_key"] + SELECTED_FEATURES + ["risk_label", "risk_label_numeric"]

    train_raw_path = os.path.join(OUTPUT_DIR, "train_raw.csv")
    val_raw_path = os.path.join(OUTPUT_DIR, "val_raw.csv")
    test_raw_path = os.path.join(OUTPUT_DIR, "test_raw.csv")

    train_df[cols_to_export].to_csv(train_raw_path, index=False)
    val_df[cols_to_export].to_csv(val_raw_path, index=False)
    test_df[cols_to_export].to_csv(test_raw_path, index=False)

    # B. Processed (standardized) splits ready for model input
    train_proc = X_train_scaled.copy()
    train_proc["user_key"] = train_df["user_key"].values
    train_proc["risk_label"] = train_df["risk_label"].values
    train_proc["risk_label_numeric"] = train_df["risk_label_numeric"].values

    val_proc = X_val_scaled.copy()
    val_proc["user_key"] = val_df["user_key"].values
    val_proc["risk_label"] = val_df["risk_label"].values
    val_proc["risk_label_numeric"] = val_df["risk_label_numeric"].values

    test_proc = X_test_scaled.copy()
    test_proc["user_key"] = test_df["user_key"].values
    test_proc["risk_label"] = test_df["risk_label"].values
    test_proc["risk_label_numeric"] = test_df["risk_label_numeric"].values

    train_proc_path = os.path.join(OUTPUT_DIR, "train_processed.csv")
    val_proc_path = os.path.join(OUTPUT_DIR, "val_processed.csv")
    test_proc_path = os.path.join(OUTPUT_DIR, "test_processed.csv")

    train_proc.to_csv(train_proc_path, index=False)
    val_proc.to_csv(val_proc_path, index=False)
    test_proc.to_csv(test_proc_path, index=False)

    # 6. Generate Metadata Report
    split_summary = {
        "dataset_name": "RespiGuard Leakage-Aware Preprocessed Dataset",
        "version": "1.0.0",
        "source_file": INPUT_DATA_PATH,
        "total_samples": len(clean_df),
        "selected_features": SELECTED_FEATURES,
        "scaler_means": {feat: float(m) for feat, m in zip(SELECTED_FEATURES, scaler.mean_)},
        "scaler_scales": {feat: float(s) for feat, s in zip(SELECTED_FEATURES, scaler.scale_)},
        "splits": {
            "train": {
                "rows": len(train_df),
                "pct": round(len(train_df) / len(clean_df) * 100, 2),
                "patients": SPLIT_PATIENTS["train"],
                "n_patients": len(SPLIT_PATIENTS["train"]),
                "classes": {
                    "Green": int((train_df["risk_label"] == "Green").sum()),
                    "Yellow": int((train_df["risk_label"] == "Yellow").sum()),
                    "Red": int((train_df["risk_label"] == "Red").sum())
                }
            },
            "val": {
                "rows": len(val_df),
                "pct": round(len(val_df) / len(clean_df) * 100, 2),
                "patients": SPLIT_PATIENTS["val"],
                "n_patients": len(SPLIT_PATIENTS["val"]),
                "classes": {
                    "Green": int((val_df["risk_label"] == "Green").sum()),
                    "Yellow": int((val_df["risk_label"] == "Yellow").sum()),
                    "Red": int((val_df["risk_label"] == "Red").sum())
                }
            },
            "test": {
                "rows": len(test_df),
                "pct": round(len(test_df) / len(clean_df) * 100, 2),
                "patients": SPLIT_PATIENTS["test"],
                "n_patients": len(SPLIT_PATIENTS["test"]),
                "classes": {
                    "Green": int((test_df["risk_label"] == "Green").sum()),
                    "Yellow": int((test_df["risk_label"] == "Yellow").sum()),
                    "Red": int((test_df["risk_label"] == "Red").sum())
                }
            }
        },
        "target_definition": TARGET_DEFINITION,
        "excluded_features": EXCLUDED_FEATURES
    }

    meta_path = os.path.join(OUTPUT_DIR, "dataset_metadata.json")
    with open(meta_path, "w") as f:
        json.dump(split_summary, f, indent=2)
    print(f"[+] Saved dataset metadata: '{meta_path}'")

    print("\nDataset Partitioning Summary:")
    print("-" * 75)
    for split_name, info in split_summary["splits"].items():
        print(f" {split_name.upper():<6} | {info['rows']:4d} rows ({info['pct']:5.1f}%) | Patients: {info['n_patients']:2d} | "
              f"G={info['classes']['Green']:3d}, Y={info['classes']['Yellow']:3d}, R={info['classes']['Red']:2d}")
    print("-" * 75)

    return split_summary


if __name__ == "__main__":
    prepare_datasets()
