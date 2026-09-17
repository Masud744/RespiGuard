"""
SHAP Feature Contribution Explainer
===================================
Produces explainability plots and single-reading risk attribution breakdowns
as outlined in Section 17 of the Embedded Systems Project Plan.
"""

import os
import pandas as pd
import numpy as np
import shap
import joblib

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "datasets", "generated")
MODELS_DIR = os.path.join(BASE_DIR, "models")

def run_shap_analysis():
    print("=" * 60)
    print("SHAP Feature Importance & Attribution Analysis")
    print("=" * 60)

    df = pd.read_csv(os.path.join(DATA_DIR, "asthma_risk_dataset.csv"))
    feature_cols = ['temperature', 'humidity', 'pm1_0', 'pm2_5', 'pm10']
    X = df[feature_cols]

    # Load trained model
    model = joblib.load(os.path.join(MODELS_DIR, "random_forest_asthma.joblib"))
    
    # Initialize TreeExplainer
    explainer = shap.TreeExplainer(model)
    shap_values = explainer.shap_values(X)

    print("[+] SHAP explainer initialized.")
    print("Feature importance based on mean absolute SHAP values across classes:")
    
    if isinstance(shap_values, list):
        mean_abs_shap = np.mean([np.abs(sv).mean(axis=0) for sv in shap_values], axis=0)
    else:
        mean_abs_shap = np.abs(shap_values).mean(axis=(0, 2)) if shap_values.ndim == 3 else np.abs(shap_values).mean(axis=0)

    feat_importance = pd.Series(mean_abs_shap, index=feature_cols).sort_values(ascending=False)
    for feat, val in feat_importance.items():
        print(f" - {feat:<12}: {val:.4f}")

    # Single inference explanation sample (simulating ESP32 reading)
    sample_reading = pd.DataFrame([{
        'temperature': 28.4,
        'humidity': 65.2,
        'pm1_0': 12.8,
        'pm2_5': 17.8,
        'pm10': 29.3
    }])
    
    pred_idx = model.predict(sample_reading)[0]
    pred_probs = model.predict_proba(sample_reading)[0]
    classes = ['Green', 'Yellow', 'Red']
    
    print("\n" + "-" * 40)
    print("Sample ESP32 Telemetry Prediction:")
    print(f" Input: {sample_reading.to_dict(orient='records')[0]}")
    print(f" Predicted Risk: {classes[pred_idx]} (Confidence: {pred_probs[pred_idx]*100:.1f}%)")
    print(f" Class Probabilities: Green={pred_probs[0]*100:.1f}%, Yellow={pred_probs[1]*100:.1f}%, Red={pred_probs[2]*100:.1f}%")
    print("-" * 40)

if __name__ == "__main__":
    run_shap_analysis()
