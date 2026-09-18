"""
RespiGuard Machine Learning Pipeline: Baseline Model Training & Evaluation
===========================================================================
Module: ml_pipeline/train_baseline_models.py

Objective:
1. Train 3 standard baseline models on finalized, leakage-free processed datasets:
   - Model 1: Multinomial Logistic Regression (Linear baseline, class-weighted)
   - Model 2: Random Forest Classifier (Bagging tree ensemble, class-weighted)
   - Model 3: XGBoost Classifier (Gradient boosted decision trees)
2. Enforce strict feature boundary:
   - Input X is strictly ['temperature', 'humidity', 'pm2_5', 'pm10'].
   - user_key and all target/tracking columns are strictly excluded.
3. Evaluate on fixed patient-wise Validation and Test sets:
   - Accuracy, Balanced Accuracy, Macro F1
   - Per-class Precision, Recall, F1
   - Confusion Matrices
   - Zero-prediction class identification
4. Save trained baseline artifacts to models/baselines/.

CRITICAL SCIENTIFIC NON-CLAIM:
Zero claims of clinical diagnosis, asthma-exacerbation forecasting, or environmental causality.
The target reflects empirical spirometry ratios in a 16-patient study with severe single-patient
class concentration.
"""

import os
import json
import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier
from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    f1_score,
    precision_score,
    recall_score,
    classification_report,
    confusion_matrix,
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "datasets", "processed")
MODELS_DIR = os.path.join(BASE_DIR, "models", "baselines")

# Strict feature contract
EXPECTED_FEATURES = ["temperature", "humidity", "pm2_5", "pm10"]
EXCLUDED_COLUMNS = ["user_key", "risk_label", "risk_label_numeric"]
CLASS_NAMES = ["Green", "Yellow", "Red"]
CLASS_LABELS = [0, 1, 2]


def load_data():
    train_path = os.path.join(DATA_DIR, "train_processed.csv")
    val_path = os.path.join(DATA_DIR, "val_processed.csv")
    test_path = os.path.join(DATA_DIR, "test_processed.csv")

    for p in [train_path, val_path, test_path]:
        if not os.path.exists(p):
            raise FileNotFoundError(f"Required dataset file not found: {p}")

    train_df = pd.read_csv(train_path)
    val_df = pd.read_csv(val_path)
    test_df = pd.read_csv(test_path)

    # 1. Strict verification: confirm tracking and target columns are present but excluded from X
    for col in EXCLUDED_COLUMNS:
        assert col in train_df.columns, f"Tracking/target column {col} missing from train_df!"

    X_train = train_df[EXPECTED_FEATURES].copy()
    y_train = train_df["risk_label_numeric"].copy()

    X_val = val_df[EXPECTED_FEATURES].copy()
    y_val = val_df["risk_label_numeric"].copy()

    X_test = test_df[EXPECTED_FEATURES].copy()
    y_test = test_df["risk_label_numeric"].copy()

    # Confirm X shapes and columns
    for name, X in [("Train", X_train), ("Val", X_val), ("Test", X_test)]:
        assert list(X.columns) == EXPECTED_FEATURES, f"{name} X columns mismatch!"
        assert "user_key" not in X.columns, f"LEAKAGE: user_key detected in {name} inputs!"
        assert "risk_label" not in X.columns, f"LEAKAGE: risk_label detected in {name} inputs!"

    return (X_train, y_train), (X_val, y_val), (X_test, y_test)


def evaluate_split(y_true, y_pred, split_name):
    acc = float(accuracy_score(y_true, y_pred))
    bacc = float(balanced_accuracy_score(y_true, y_pred))
    macro_f1 = float(f1_score(y_true, y_pred, average="macro", zero_division=0))
    cm = confusion_matrix(y_true, y_pred, labels=CLASS_LABELS)

    # Per-class metrics
    precisions = precision_score(y_true, y_pred, labels=CLASS_LABELS, average=None, zero_division=0)
    recalls = recall_score(y_true, y_pred, labels=CLASS_LABELS, average=None, zero_division=0)
    f1s = f1_score(y_true, y_pred, labels=CLASS_LABELS, average=None, zero_division=0)

    per_class = {}
    for i, cname in enumerate(CLASS_NAMES):
        support = int((y_true == i).sum())
        predicted_count = int((y_pred == i).sum())
        per_class[cname] = {
            "support": support,
            "predicted_count": predicted_count,
            "precision": round(float(precisions[i]), 4),
            "recall": round(float(recalls[i]), 4),
            "f1": round(float(f1s[i]), 4),
            "never_predicted": bool(predicted_count == 0),
            "zero_correct": bool(support > 0 and cm[i, i] == 0)
        }

    # Detect never predicted classes across entire split
    never_predicted = [cname for cname, d in per_class.items() if d["never_predicted"]]

    return {
        "split": split_name,
        "total_samples": len(y_true),
        "accuracy": round(acc, 4),
        "balanced_accuracy": round(bacc, 4),
        "macro_f1": round(macro_f1, 4),
        "confusion_matrix": cm.tolist(),
        "never_predicted_classes": never_predicted,
        "per_class": per_class
    }


def train_and_evaluate_all():
    os.makedirs(MODELS_DIR, exist_ok=True)
    print("=" * 80)
    print("RESPIGUARD BASELINE ML MODEL TRAINING & LEAKAGE-FREE EVALUATION")
    print("=" * 80)

    (X_train, y_train), (X_val, y_val), (X_test, y_test) = load_data()

    print(f"\n[+] Input Features: {EXPECTED_FEATURES} (Total: {len(EXPECTED_FEATURES)})")
    print(f"[+] Confirmed Exclusions: {EXCLUDED_COLUMNS}")
    print(f"[+] Dataset Shapes:")
    print(f"    Train: {X_train.shape[0]:4d} samples | Class distribution: Green={sum(y_train==0)}, Yellow={sum(y_train==1)}, Red={sum(y_train==2)}")
    print(f"    Val:   {X_val.shape[0]:4d} samples | Class distribution: Green={sum(y_val==0)}, Yellow={sum(y_val==1)}, Red={sum(y_val==2)} [NOTE: EXACTLY 0 RED SAMPLES]")
    print(f"    Test:  {X_test.shape[0]:4d} samples | Class distribution: Green={sum(y_test==0)}, Yellow={sum(y_test==1)}, Red={sum(y_test==2)} [NOTE: EXACTLY 4 RED SAMPLES]")

    # Define 3 baseline models
    baseline_configs = {
        "logistic_regression": {
            "title": "Baseline 1: Multinomial Logistic Regression",
            "model": LogisticRegression(
                class_weight="balanced",
                C=1.0,
                solver="lbfgs",
                max_iter=1000,
                random_state=42
            ),
            "file": "logistic_regression.joblib"
        },
        "random_forest": {
            "title": "Baseline 2: Random Forest Classifier",
            "model": RandomForestClassifier(
                n_estimators=100,
                max_depth=5,
                class_weight="balanced",
                random_state=42
            ),
            "file": "random_forest.joblib"
        },
        "xgboost": {
            "title": "Baseline 3: XGBoost Classifier",
            "model": XGBClassifier(
                n_estimators=100,
                max_depth=3,
                learning_rate=0.05,
                eval_metric="mlogloss",
                random_state=42
            ),
            "file": "xgboost.joblib"
        }
    }

    all_results = {}

    for key, cfg in baseline_configs.items():
        print("\n" + "=" * 80)
        print(f"TRAINING: {cfg['title']}")
        print("=" * 80)

        clf = cfg["model"]
        clf.fit(X_train, y_train)

        # Save model artifact
        save_path = os.path.join(MODELS_DIR, cfg["file"])
        joblib.dump(clf, save_path)
        print(f"[+] Saved model bundle: '{save_path}'")

        # Predictions
        y_val_pred = clf.predict(X_val)
        y_test_pred = clf.predict(X_test)

        val_metrics = evaluate_split(y_val, y_val_pred, "Validation")
        test_metrics = evaluate_split(y_test, y_test_pred, "Test")

        all_results[key] = {
            "model_key": key,
            "title": cfg["title"],
            "hyperparameters": {k: str(v) for k, v in clf.get_params().items() if k in ["C", "class_weight", "solver", "n_estimators", "max_depth", "learning_rate"]},
            "artifact_path": save_path,
            "validation_metrics": val_metrics,
            "test_metrics": test_metrics
        }

        # Print detailed report for this model
        print("\n--- VALIDATION SET (260 samples | Ground Truth: Green=106, Yellow=154, Red=0) ---")
        print(f"Accuracy:          {val_metrics['accuracy'] * 100:.2f}%")
        print(f"Balanced Accuracy: {val_metrics['balanced_accuracy'] * 100:.2f}%")
        print(f"Macro F1:          {val_metrics['macro_f1']:.4f}")
        print("Confusion Matrix (Row=True [G,Y,R], Col=Pred [G,Y,R]):")
        cm_v = np.array(val_metrics["confusion_matrix"])
        print(f"  True Green  (106) -> Pred G: {cm_v[0,0]:3d} | Pred Y: {cm_v[0,1]:3d} | Pred R: {cm_v[0,2]:3d}")
        print(f"  True Yellow (154) -> Pred G: {cm_v[1,0]:3d} | Pred Y: {cm_v[1,1]:3d} | Pred R: {cm_v[1,2]:3d}")
        print(f"  True Red      (0) -> Pred G: {cm_v[2,0]:3d} | Pred Y: {cm_v[2,1]:3d} | Pred R: {cm_v[2,2]:3d}")
        if val_metrics["never_predicted_classes"]:
            print(f"  [!] Classes NEVER predicted on Validation: {val_metrics['never_predicted_classes']}")

        print("\n--- TEST SET (219 samples | Ground Truth: Green=108, Yellow=107, Red=4) ---")
        print(f"Accuracy:          {test_metrics['accuracy'] * 100:.2f}%")
        print(f"Balanced Accuracy: {test_metrics['balanced_accuracy'] * 100:.2f}%")
        print(f"Macro F1:          {test_metrics['macro_f1']:.4f}")
        print("Confusion Matrix (Row=True [G,Y,R], Col=Pred [G,Y,R]):")
        cm_t = np.array(test_metrics["confusion_matrix"])
        print(f"  True Green  (108) -> Pred G: {cm_t[0,0]:3d} | Pred Y: {cm_t[0,1]:3d} | Pred R: {cm_t[0,2]:3d}")
        print(f"  True Yellow (107) -> Pred G: {cm_t[1,0]:3d} | Pred Y: {cm_t[1,1]:3d} | Pred R: {cm_t[1,2]:3d}")
        print(f"  True Red      (4) -> Pred G: {cm_t[2,0]:3d} | Pred Y: {cm_t[2,1]:3d} | Pred R: {cm_t[2,2]:3d}")
        if test_metrics["never_predicted_classes"]:
            print(f"  [!] Classes NEVER predicted on Test: {test_metrics['never_predicted_classes']}")
        if test_metrics["per_class"]["Red"]["zero_correct"]:
            print("  [!] WARNING: Model failed to identify ANY of the 4 Red samples correctly on Test!")

    # Save comprehensive evaluation JSON
    results_path = os.path.join(MODELS_DIR, "baseline_evaluation_results.json")
    with open(results_path, "w") as f:
        json.dump(all_results, f, indent=2)
    print(f"\n[+] Saved full evaluation report: '{results_path}'")

    return all_results


if __name__ == "__main__":
    train_and_evaluate_all()
