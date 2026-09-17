"""
Train 2-Stage Hierarchical ML Pipeline for RespiGuard Portable Device
====================================================================
Stage 1: Safety Gate (CatBoost: Safe vs At-Risk)
Stage 2: Severity Triage (XGBoost: Moderate vs Danger)
Artifact Output: two_stage_asthma_model.joblib (Portable Bundle)
"""

import os
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.metrics import accuracy_score, classification_report, f1_score
from catboost import CatBoostClassifier
from xgboost import XGBClassifier
import joblib

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "datasets", "generated")
MODELS_DIR = os.path.join(BASE_DIR, "models")

def train_and_save():
    print("=" * 70)
    print("Training 2-Stage Hierarchical ML Pipeline (CatBoost + XGBoost)...")
    print("=" * 70)
    
    df = pd.read_csv(os.path.join(DATA_DIR, "asthma_risk_extended.csv"))
    
    num_features = ['temperature', 'humidity', 'pm1_0', 'pm2_5', 'pm10', 'effective_pef_best']
    cat_features = ['severity', 'age_range', 'sex']
    all_features = num_features + cat_features
    
    X = df[all_features].copy()
    label_map = {'Green': 0, 'Yellow': 1, 'Red': 2}
    y = df['risk_label'].map(label_map)
    
    preprocessor = ColumnTransformer(
        transformers=[
            ('num', StandardScaler(), num_features),
            ('cat', OneHotEncoder(handle_unknown='ignore'), cat_features)
        ]
    )
    
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=42, stratify=y
    )
    
    # 1. Transform features
    X_train_trans = preprocessor.fit_transform(X_train)
    X_test_trans = preprocessor.transform(X_test)
    
    # 2. Stage 1: CatBoost Safety Gate (0: Green, 1: Yellow+Red)
    y_train_s1 = (y_train > 0).astype(int)
    stage1_model = CatBoostClassifier(
        iterations=250, 
        depth=6, 
        learning_rate=0.07, 
        verbose=0, 
        random_state=42
    )
    stage1_model.fit(X_train_trans, y_train_s1)
    
    # 3. Stage 2: XGBoost Severity Triage (0: Yellow, 1: Red)
    at_risk_mask = (y_train > 0).to_numpy()
    X_train_s2 = X_train_trans[at_risk_mask]
    y_train_s2 = (y_train.iloc[at_risk_mask] == 2).astype(int).to_numpy()
    
    stage2_model = XGBClassifier(
        n_estimators=150, 
        max_depth=4, 
        learning_rate=0.06, 
        eval_metric='logloss', 
        random_state=42
    )
    stage2_model.fit(X_train_s2, y_train_s2)
    
    # 4. Evaluate End-to-End on Test Set
    s1_preds = np.array(stage1_model.predict(X_test_trans)).ravel().astype(int)
    final_preds = np.zeros(len(s1_preds), dtype=int)
    
    at_risk_idx = np.where(s1_preds == 1)[0]
    if len(at_risk_idx) > 0:
        s2_preds = np.array(stage2_model.predict(X_test_trans[at_risk_idx])).ravel().astype(int)
        final_preds[at_risk_idx] = np.where(s2_preds == 1, 2, 1)
        
    acc = accuracy_score(y_test, final_preds)
    f1 = f1_score(y_test, final_preds, average='macro')
    
    print(f"\n[+] 2-Stage Test Accuracy: {acc*100:.2f}% | Macro F1: {f1:.4f}")
    print("\nClassification Report:")
    print(classification_report(y_test, final_preds, target_names=['Green', 'Yellow', 'Red'], digits=4))
    
    # Save clean dictionary bundle
    bundle = {
        'preprocessor': preprocessor,
        'stage1_model': stage1_model,
        'stage2_model': stage2_model,
        'num_features': num_features,
        'cat_features': cat_features,
        'all_features': all_features,
        'classes': ['Green', 'Yellow', 'Red']
    }
    
    os.makedirs(MODELS_DIR, exist_ok=True)
    artifact_path = os.path.join(MODELS_DIR, "two_stage_asthma_model.joblib")
    joblib.dump(bundle, artifact_path)
    print(f"\n[+] Successfully saved model bundle to '{artifact_path}'")

if __name__ == "__main__":
    train_and_save()
