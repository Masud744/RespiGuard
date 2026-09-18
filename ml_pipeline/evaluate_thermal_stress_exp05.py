#!/usr/bin/env python3
"""
EXP-TUNE-05: Composite Thermal-Stress & Hazard Feature Evaluation
================================================================
Evaluates the impact of physiological cold-stress feature engineering
(cold_stress_index and apparent_temp from MetrologyEngine) on:
1. Patient-Level Unseen Benchmark (N = 219, Test Patients: [113, 343, 701, 867])
2. Safeguarded Chronological Benchmark (N = 290, 15 Monitored Patients)

Focus:
Verifying whether explicit thermal-stress features bridge the cross-subject
trigger divergence between Patient 190 (warm particulate spikes) and
Patient 343 (near-freezing cold bronchospasm).
"""

import os
import sys
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, balanced_accuracy_score, f1_score, confusion_matrix
from catboost import CatBoostClassifier

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

from ml_pipeline.environmental_hazard_engine import MetrologyEngine

DATA_PATH = os.path.join(BASE_DIR, "datasets", "generated", "asthma_risk_corrected_audit.csv")

def run_exp05_evaluation():
    print("=" * 80)
    print("EXP-TUNE-05: COMPOSITE THERMAL-STRESS BENCHMARK EVALUATION")
    print("=" * 80)

    if not os.path.exists(DATA_PATH):
        print(f"Error: Dataset {DATA_PATH} not found.")
        return

    df = pd.read_csv(DATA_PATH)
    
    # Generate engineered thermal stress features using MetrologyEngine
    df['apparent_temp'] = df.apply(
        lambda r: MetrologyEngine.calculate_apparent_temperature(r['temperature'], r['humidity']), axis=1
    )
    df['cold_stress_index'] = df.apply(
        lambda r: MetrologyEngine.calculate_cold_stress_index(r['temperature'], r['humidity']), axis=1
    )

    # -----------------------------------------------------------------
    # 1. PATIENT-LEVEL UNSEEN EVALUATION (N = 219)
    # -----------------------------------------------------------------
    test_patients = [113, 343, 701, 867]
    train_unseen = df[~df['user_key'].isin(test_patients)].copy()
    test_unseen = df[df['user_key'].isin(test_patients)].copy()

    features_4 = ['temperature', 'humidity', 'pm2_5', 'pm10']
    features_6 = ['temperature', 'humidity', 'pm2_5', 'pm10', 'apparent_temp', 'cold_stress_index']

    y_train_u = train_unseen['risk_label_numeric'].to_numpy()
    y_test_u = test_unseen['risk_label_numeric'].to_numpy()

    # Train 4-sensor baseline
    sc_4 = StandardScaler()
    X_tr_4 = sc_4.fit_transform(train_unseen[features_4])
    X_te_4 = sc_4.transform(test_unseen[features_4])

    st1_4 = CatBoostClassifier(iterations=250, depth=5, learning_rate=0.07, auto_class_weights='Balanced', verbose=0, random_state=42)
    st1_4.fit(X_tr_4, (y_train_u > 0).astype(int))
    st2_4 = CatBoostClassifier(iterations=250, depth=4, learning_rate=0.06, auto_class_weights='Balanced', verbose=0, random_state=42)
    st2_4.fit(X_tr_4[y_train_u > 0], (y_train_u[y_train_u > 0] == 2).astype(int))

    p1_u_4 = st1_4.predict_proba(X_te_4)[:, 1]
    p2_u_4 = st2_4.predict_proba(X_te_4)[:, 1]

    # Train 6-sensor thermal-augmented pipeline (EXP-TUNE-05)
    sc_6 = StandardScaler()
    X_tr_6 = sc_6.fit_transform(train_unseen[features_6])
    X_te_6 = sc_6.transform(test_unseen[features_6])

    st1_6 = CatBoostClassifier(iterations=250, depth=5, learning_rate=0.07, auto_class_weights='Balanced', verbose=0, random_state=42)
    st1_6.fit(X_tr_6, (y_train_u > 0).astype(int))
    st2_6 = CatBoostClassifier(iterations=250, depth=4, learning_rate=0.06, auto_class_weights='Balanced', verbose=0, random_state=42)
    st2_6.fit(X_tr_6[y_train_u > 0], (y_train_u[y_train_u > 0] == 2).astype(int))

    p1_u_6 = st1_6.predict_proba(X_te_6)[:, 1]
    p2_u_6 = st2_6.predict_proba(X_te_6)[:, 1]

    print("\n--- TRACK A: PATIENT-LEVEL UNSEEN EVALUATION (N = 219) ---")
    experiments_unseen = [
        ("EXP-TUNE-01B (4-Sensor Balanced)", p1_u_4, p2_u_4, 0.50, 0.50),
        ("EXP-TUNE-02 (4-Sensor CV Thresholds)", p1_u_4, p2_u_4, 0.35, 0.25),
        ("EXP-TUNE-05A (Thermal Stress Standard)", p1_u_6, p2_u_6, 0.50, 0.50),
        ("EXP-TUNE-05B (Thermal Stress CV Thresholds)", p1_u_6, p2_u_6, 0.35, 0.25),
    ]

    for name, p1, p2, tau1, tau2 in experiments_unseen:
        preds = np.zeros(len(y_test_u), dtype=int)
        mask = (p1 >= tau1)
        preds[mask] = np.where(p2[mask] >= tau2, 2, 1)

        acc = accuracy_score(y_test_u, preds)
        bacc = balanced_accuracy_score(y_test_u, preds)
        mf1 = f1_score(y_test_u, preds, average='macro', zero_division=0)
        wf1 = f1_score(y_test_u, preds, average='weighted', zero_division=0)
        cm = confusion_matrix(y_test_u, preds, labels=[0, 1, 2])
        red_tp = cm[2, 2]
        red_fn_green = cm[2, 0]

        print(f"\n[{name}]")
        print(f"Accuracy: {acc*100:.2f}% | Balanced Acc: {bacc*100:.2f}% | Macro F1: {mf1:.4f} | Weighted F1: {wf1:.4f}")
        print(f"Red Recall: {red_tp}/4 ({red_tp/4*100:.1f}%) | Red->Green FN: {red_fn_green}/4 ({red_fn_green/4*100:.1f}%)")
        print(f"Confusion Matrix (G, Y, R):\n{cm}")

    # -----------------------------------------------------------------
    # 2. SAFEGUARDED CHRONOLOGICAL EVALUATION (N = 290)
    # -----------------------------------------------------------------
    # Each patient's first 75% calendar dates in training, last 25% in testing.
    # Single-date patient 217 excluded from test under safeguard policy.
    train_chrono_idx = []
    test_chrono_idx = []

    for uk, grp in df.groupby('user_key'):
        if uk == 217:
            train_chrono_idx.extend(grp.index)
            continue
        unique_dates = sorted(grp['date'].unique())
        n_dates = len(unique_dates)
        if n_dates < 2:
            train_chrono_idx.extend(grp.index)
            continue
        split_pt = int(np.floor(n_dates * 0.75))
        split_pt = max(1, min(split_pt, n_dates - 1))
        train_dates = set(unique_dates[:split_pt])
        test_dates = set(unique_dates[split_pt:])

        train_chrono_idx.extend(grp[grp['date'].isin(train_dates)].index)
        test_chrono_idx.extend(grp[grp['date'].isin(test_dates)].index)

    train_c = df.loc[train_chrono_idx].copy()
    test_c = df.loc[test_chrono_idx].copy()

    y_train_c = train_c['risk_label_numeric'].to_numpy()
    y_test_c = test_c['risk_label_numeric'].to_numpy()

    # Train 4-sensor chronological
    sc_c4 = StandardScaler()
    X_tr_c4 = sc_c4.fit_transform(train_c[features_4])
    X_te_c4 = sc_c4.transform(test_c[features_4])

    st1_c4 = CatBoostClassifier(iterations=250, depth=5, learning_rate=0.07, auto_class_weights='Balanced', verbose=0, random_state=42)
    st1_c4.fit(X_tr_c4, (y_train_c > 0).astype(int))
    st2_c4 = CatBoostClassifier(iterations=250, depth=4, learning_rate=0.06, auto_class_weights='Balanced', verbose=0, random_state=42)
    st2_c4.fit(X_tr_c4[y_train_c > 0], (y_train_c[y_train_c > 0] == 2).astype(int))

    p1_c_4 = st1_c4.predict_proba(X_te_c4)[:, 1]
    p2_c_4 = st2_c4.predict_proba(X_te_c4)[:, 1]

    # Train 6-sensor thermal chronological (EXP-TUNE-05)
    sc_c6 = StandardScaler()
    X_tr_c6 = sc_c6.fit_transform(train_c[features_6])
    X_te_c6 = sc_c6.transform(test_c[features_6])

    st1_c6 = CatBoostClassifier(iterations=250, depth=5, learning_rate=0.07, auto_class_weights='Balanced', verbose=0, random_state=42)
    st1_c6.fit(X_tr_c6, (y_train_c > 0).astype(int))
    st2_c6 = CatBoostClassifier(iterations=250, depth=4, learning_rate=0.06, auto_class_weights='Balanced', verbose=0, random_state=42)
    st2_c6.fit(X_tr_c6[y_train_c > 0], (y_train_c[y_train_c > 0] == 2).astype(int))

    p1_c_6 = st1_c6.predict_proba(X_te_c6)[:, 1]
    p2_c_6 = st2_c6.predict_proba(X_te_c6)[:, 1]

    print("\n\n--- TRACK B: SAFEGUARDED CHRONOLOGICAL EVALUATION (N = 290) ---")
    experiments_chrono = [
        ("EXP-TUNE-01B (4-Sensor Balanced)", p1_c_4, p2_c_4, 0.50, 0.50),
        ("EXP-TUNE-05A (Thermal Stress Standard)", p1_c_6, p2_c_6, 0.50, 0.50),
        ("EXP-TUNE-05B (Thermal Stress CV Thresholds)", p1_c_6, p2_c_6, 0.35, 0.25),
    ]

    for name, p1, p2, tau1, tau2 in experiments_chrono:
        preds = np.zeros(len(y_test_c), dtype=int)
        mask = (p1 >= tau1)
        preds[mask] = np.where(p2[mask] >= tau2, 2, 1)

        acc = accuracy_score(y_test_c, preds)
        bacc = balanced_accuracy_score(y_test_c, preds)
        mf1 = f1_score(y_test_c, preds, average='macro', zero_division=0)
        wf1 = f1_score(y_test_c, preds, average='weighted', zero_division=0)
        cm = confusion_matrix(y_test_c, preds, labels=[0, 1, 2])
        red_tp = cm[2, 2]
        red_fn_green = cm[2, 0]

        print(f"\n[{name}]")
        print(f"Accuracy: {acc*100:.2f}% | Balanced Acc: {bacc*100:.2f}% | Macro F1: {mf1:.4f} | Weighted F1: {wf1:.4f}")
        print(f"Red Recall: {red_tp}/2 ({red_tp/2*100:.1f}%) | Red->Green FN: {red_fn_green}/2 ({red_fn_green/2*100:.1f}%)")
        print(f"Confusion Matrix (G, Y, R):\n{cm}")

if __name__ == "__main__":
    run_exp05_evaluation()
