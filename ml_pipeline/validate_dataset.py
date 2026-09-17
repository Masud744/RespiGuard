"""
Dataset Validation & Baseline Model Benchmark
=============================================
Performs:
1. Dataset Integrity & Schema Checks
2. Class Balance & Feature Statistics
3. Machine Learning Model Training (Logistic Regression, Random Forest, XGBoost)
4. Evaluation with 5-Fold Stratified CV & GroupKFold (Patient-Wise Split)
5. Metric reporting: Accuracy, F1-Macro, F1-Weighted, High-Risk (Red) Recall
6. Model artifact persistence (random_forest_asthma.joblib)
"""

import os
import pandas as pd
import numpy as np
from sklearn.model_selection import StratifiedKFold, GroupKFold, cross_validate
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix, f1_score, recall_score, accuracy_score
from sklearn.preprocessing import StandardScaler
from xgboost import XGBClassifier
import joblib

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "datasets", "generated")
MODELS_DIR = os.path.join(BASE_DIR, "models")

def validate():
    print("=" * 60)
    print("1. DATASET INTEGRITY & VALIDATION REPORT")
    print("=" * 60)

    df = pd.read_csv(os.path.join(DATA_DIR, "asthma_risk_dataset.csv"))
    ext_df = pd.read_csv(os.path.join(DATA_DIR, "asthma_risk_extended.csv"))

    expected_cols = ['timestamp', 'temperature', 'humidity', 'pm1_0', 'pm2_5', 'pm10', 'risk_label']
    assert list(df.columns) == expected_cols, f"Column mismatch! Expected {expected_cols}, got {list(df.columns)}"

    print(f"Total Rows: {len(df)}")
    print(f"Total Columns: {len(df.columns)}")
    print(f"Columns: {list(df.columns)}")

    # Null check
    null_counts = df.isnull().sum()
    print("\nMissing values:")
    print(null_counts)
    assert null_counts.sum() == 0, "Found null values in primary dataset!"

    # Value sanity check
    assert (df['humidity'] >= 0).all() and (df['humidity'] <= 100).all(), "Humidity out of bounds [0, 100]"
    assert (df['pm1_0'] <= df['pm2_5']).all(), "PM1.0 should be <= PM2.5"
    assert (df['pm2_5'] <= df['pm10'] + 1.0).all(), "PM2.5 should not significantly exceed PM10"

    print("\n[+] Integrity checks passed successfully!")

    print("\nClass Distribution:")
    for label, count in df['risk_label'].value_counts().items():
        pct = count / len(df) * 100
        print(f" - {label:<8}: {count:>4} samples ({pct:>5.2f}%)")

    # 2. Baseline Model Evaluation
    print("\n" + "=" * 60)
    print("2. BASELINE MACHINE LEARNING BENCHMARK (5-FOLD CV)")
    print("=" * 60)

    feature_cols = ['temperature', 'humidity', 'pm1_0', 'pm2_5', 'pm10']
    X = df[feature_cols]
    label_map = {'Green': 0, 'Yellow': 1, 'Red': 2}
    y = df['risk_label'].map(label_map)

    # Standard Stratified 5-Fold CV
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

    models = {
        "Logistic Regression": LogisticRegression(max_iter=1000, class_weight='balanced', random_state=42),
        "Random Forest": RandomForestClassifier(n_estimators=200, max_depth=8, class_weight='balanced', random_state=42),
        "XGBoost": XGBClassifier(n_estimators=150, max_depth=5, learning_rate=0.08, eval_metric='mlogloss', random_state=42)
    }

    results = []

    for name, clf in models.items():
        acc_list, f1_macro_list, f1_weighted_list, red_recall_list = [], [], [], []

        for train_idx, test_idx in skf.split(X, y):
            X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
            y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]

            if name == "Logistic Regression":
                scaler = StandardScaler()
                X_train = scaler.fit_transform(X_train)
                X_test = scaler.transform(X_test)

            clf.fit(X_train, y_train)
            y_pred = clf.predict(X_test)

            acc_list.append(accuracy_score(y_test, y_pred))
            f1_macro_list.append(f1_score(y_test, y_pred, average='macro'))
            f1_weighted_list.append(f1_score(y_test, y_pred, average='weighted'))
            
            # High risk recall (Class 2: Red)
            rec = recall_score(y_test, y_pred, labels=[2], average='macro', zero_division=0)
            red_recall_list.append(rec)

        res = {
            "Model": name,
            "Accuracy": f"{np.mean(acc_list)*100:.2f}% ± {np.std(acc_list)*100:.2f}%",
            "F1-Macro": f"{np.mean(f1_macro_list):.4f}",
            "F1-Weighted": f"{np.mean(f1_weighted_list):.4f}",
            "High-Risk (Red) Recall": f"{np.mean(red_recall_list)*100:.2f}%"
        }
        results.append(res)

    results_df = pd.DataFrame(results)
    print("\nStratified 5-Fold Cross Validation Results:")
    print(results_df.to_string(index=False))

    # 3. Patient-Wise Cross Validation (GroupKFold by user_key)
    print("\n" + "=" * 60)
    print("3. PATIENT-WISE CROSS VALIDATION (PREVENTING DATA LEAKAGE)")
    print("=" * 60)

    groups = ext_df['user_key']
    gkf = GroupKFold(n_splits=5)
    rf_gkf = RandomForestClassifier(n_estimators=200, max_depth=8, class_weight='balanced', random_state=42)

    gkf_acc, gkf_f1, gkf_red_recall = [], [], []
    for train_idx, test_idx in gkf.split(X, y, groups):
        X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
        y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]

        rf_gkf.fit(X_train, y_train)
        y_pred = rf_gkf.predict(X_test)

        gkf_acc.append(accuracy_score(y_test, y_pred))
        gkf_f1.append(f1_score(y_test, y_pred, average='weighted'))
        gkf_red_recall.append(recall_score(y_test, y_pred, labels=[2], average='macro', zero_division=0))

    print(f"Random Forest (Patient-Wise Group 5-Fold):")
    print(f" - Mean Accuracy:          {np.mean(gkf_acc)*100:.2f}% ± {np.std(gkf_acc)*100:.2f}%")
    print(f" - Weighted F1-Score:      {np.mean(gkf_f1):.4f}")
    print(f" - High-Risk Recall (Red): {np.mean(gkf_red_recall)*100:.2f}%")

    # 4. Train and save final production model
    final_rf = RandomForestClassifier(n_estimators=200, max_depth=8, class_weight='balanced', random_state=42)
    final_rf.fit(X, y)
    
    # Feature importances
    print("\nRandom Forest Feature Importances:")
    importances = pd.Series(final_rf.feature_importances_, index=feature_cols).sort_values(ascending=False)
    for feat, imp in importances.items():
        print(f" - {feat:<12}: {imp*100:>5.2f}%")

    os.makedirs(MODELS_DIR, exist_ok=True)
    model_path = os.path.join(MODELS_DIR, "random_forest_asthma.joblib")
    joblib.dump(final_rf, model_path)
    print(f"\n[+] Trained model persisted to '{model_path}'")

if __name__ == "__main__":
    validate()
