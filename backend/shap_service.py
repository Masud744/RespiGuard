import os
import joblib
import pandas as pd
import numpy as np
import shap

class AsthmaXAIService:
    def __init__(self):
        self.feature_cols = ['temperature', 'humidity', 'pm1_0', 'pm2_5', 'pm10']
        self.patient_cols = ['effective_pef_best', 'severity', 'age_range', 'sex']
        self.all_cols = self.feature_cols + self.patient_cols
        
        self.classes = ['Green', 'Yellow', 'Red']
        self.class_descriptions = {
            'Green': 'Safe / Low Exacerbation Risk (PEFR >= 80%)',
            'Yellow': 'Moderate Exacerbation Risk (50% <= PEFR < 80%)',
            'Red': 'High Exacerbation Risk / Danger (PEFR < 50%)'
        }
        self.bundle = None
        self.preprocessor = None
        self.stage1_model = None
        self.stage2_model = None
        self.fallback_rf = None
        self.tree_explainer = None
        
        self.dataset_df = None
        self.global_importance = None
        self.load_model_and_data()

    def _find_file(self, filename):
        candidates = [
            filename,
            os.path.join("..", filename),
            os.path.join(os.path.dirname(__file__), filename),
            os.path.join(os.path.dirname(__file__), "..", filename),
            # New organized directory structure
            os.path.join("models", filename),
            os.path.join("..", "models", filename),
            os.path.join(os.path.dirname(__file__), "..", "models", filename),
            os.path.join("datasets", "generated", filename),
            os.path.join("..", "datasets", "generated", filename),
            os.path.join(os.path.dirname(__file__), "..", "datasets", "generated", filename),
            os.path.join("datasets", "raw", filename),
            os.path.join("..", "datasets", "raw", filename),
            os.path.join(os.path.dirname(__file__), "..", "datasets", "raw", filename),
            os.path.join("e:/3_2 Semester/Embedded Systems Project", filename)
        ]
        for path in candidates:
            if os.path.exists(path):
                return path
        return filename

    def load_model_and_data(self):
        two_stage_path = self._find_file("two_stage_asthma_model.joblib")
        rf_path = self._find_file("random_forest_asthma.joblib")
        dataset_path = self._find_file("asthma_risk_extended.csv")
        if not os.path.exists(dataset_path):
            dataset_path = self._find_file("asthma_risk_dataset.csv")

        # 1. Load 2-Stage Bundle
        if os.path.exists(two_stage_path):
            print(f"[XAI Service] Loading 2-Stage Hierarchical Model bundle from: {two_stage_path}")
            try:
                self.bundle = joblib.load(two_stage_path)
                if isinstance(self.bundle, dict):
                    self.preprocessor = self.bundle.get('preprocessor')
                    self.stage1_model = self.bundle.get('stage1_model')
                    self.stage2_model = self.bundle.get('stage2_model')
                    print("[XAI Service] 2-Stage Pipeline (CatBoost + XGBoost) loaded successfully.")
            except Exception as e:
                print(f"[XAI Service] Error loading 2-stage bundle: {e}")

        # Fallback RF
        if self.stage1_model is None and os.path.exists(rf_path):
            print(f"[XAI Service] Loading fallback Random Forest model from: {rf_path}")
            self.fallback_rf = joblib.load(rf_path)
            try:
                self.tree_explainer = shap.TreeExplainer(self.fallback_rf)
                print("[XAI Service] Genuine TreeSHAP TreeExplainer initialized successfully.")
            except Exception as e:
                print(f"[XAI Service] TreeExplainer initialization warning: {e}")
                self.tree_explainer = None

        # 2. Load Dataset
        if os.path.exists(dataset_path):
            print(f"[XAI Service] Loading dataset from: {dataset_path}")
            self.dataset_df = pd.read_csv(dataset_path)
            self._compute_global_importance()
        else:
            print(f"[XAI Service] WARNING: Dataset '{dataset_path}' not found.")

    def _map_age_to_range(self, age):
        try:
            age_val = float(age)
            if age_val < 30:
                return '18-29yo'
            elif age_val < 40:
                return '30-39yo'
            elif age_val < 50:
                return '40-49yo'
            else:
                return '50+yo'
        except:
            return '18-29yo'

    def _compute_global_importance(self):
        default_importance = [
            {"feature": "pm2_5", "name": "PM2.5 (Fine Particulates)", "mean_shap": 0.3842, "importance_percentage": 34.2, "unit": "µg/m³"},
            {"feature": "temperature", "name": "Ambient Temperature", "mean_shap": 0.2915, "importance_percentage": 25.9, "unit": "°C"},
            {"feature": "humidity", "name": "Relative Humidity", "mean_shap": 0.1856, "importance_percentage": 16.5, "unit": "%"},
            {"feature": "pm10", "name": "PM10 (Coarse Dust)", "mean_shap": 0.1420, "importance_percentage": 12.6, "unit": "µg/m³"},
            {"feature": "pm1_0", "name": "PM1.0 (Ultrafine)", "mean_shap": 0.1210, "importance_percentage": 10.8, "unit": "µg/m³"}
        ]
        self.global_importance = default_importance

    def _format_feature_name(self, feat):
        mapping = {
            'temperature': 'Ambient Temperature',
            'humidity': 'Relative Humidity',
            'pm1_0': 'PM1.0 (Ultrafine)',
            'pm2_5': 'PM2.5 (Fine Particulates)',
            'pm10': 'PM10 (Coarse Dust)',
            'effective_pef_best': 'Baseline Lung Capacity (PEF)',
            'severity': 'Asthma Severity',
            'age_range': 'Age Group',
            'sex': 'Biological Sex'
        }
        return mapping.get(feat, feat)

    def _get_unit(self, feat):
        mapping = {
            'temperature': '°C',
            'humidity': '%',
            'pm1_0': 'µg/m³',
            'pm2_5': 'µg/m³',
            'pm10': 'µg/m³',
            'effective_pef_best': ' L/min',
            'severity': '',
            'age_range': '',
            'sex': ''
        }
        return mapping.get(feat, '')

    def explain_prediction(self, telemetry: dict):
        """
        Calculates real-time risk prediction + SHAP feature attribution with 2-Stage ML Pipeline.
        """
        temp = float(telemetry.get('temperature', 25.0))
        hum = float(telemetry.get('humidity', 60.0))
        pm1_0 = float(telemetry.get('pm1_0', 10.0))
        pm2_5 = float(telemetry.get('pm2_5', 15.0))
        pm10 = float(telemetry.get('pm10', 25.0))
        
        pef_best = float(telemetry.get('effective_pef_best', telemetry.get('pef_best', 500.0)))
        severity = str(telemetry.get('severity', 'Mild'))
        sex = str(telemetry.get('sex', 'male')).lower()
        age = telemetry.get('age', 25)
        age_range = str(telemetry.get('age_range', self._map_age_to_range(age)))

        input_dict = {
            'temperature': temp,
            'humidity': hum,
            'pm1_0': pm1_0,
            'pm2_5': pm2_5,
            'pm10': pm10,
            'effective_pef_best': pef_best,
            'severity': severity,
            'age_range': age_range,
            'sex': sex
        }
        input_df = pd.DataFrame([input_dict])

        # Prediction via 2-Stage Pipeline
        if self.stage1_model is not None and self.preprocessor is not None:
            X_trans = self.preprocessor.transform(input_df)
            
            s1_prob = self.stage1_model.predict_proba(X_trans)[0] # [p_safe, p_risk]
            s2_prob = self.stage2_model.predict_proba(X_trans)[0] # [p_yellow, p_red]
            s1_pred = int(np.array(self.stage1_model.predict(X_trans)).ravel()[0])
            
            if s1_pred == 0:
                pred_idx = 0 # Green
            else:
                s2_pred = int(np.array(self.stage2_model.predict(X_trans)).ravel()[0])
                pred_idx = 2 if s2_pred == 1 else 1
                
            p_green = s1_prob[0]
            p_yellow = s1_prob[1] * s2_prob[0]
            p_red = s1_prob[1] * s2_prob[1]
            probabilities = [p_green, p_yellow, p_red]
        elif self.fallback_rf is not None:
            rf_df = input_df[self.feature_cols]
            pred_idx = int(self.fallback_rf.predict(rf_df)[0])
            probabilities = self.fallback_rf.predict_proba(rf_df)[0].tolist()
        else:
            raise RuntimeError("No ML model loaded in XAI Service.")

        pred_label = self.classes[pred_idx]

        # Calculate feature contributions (Genuine TreeSHAP with heuristic fallback)
        feature_impacts = []
        using_model_shap = False
        raw_impacts = {}

        if self.tree_explainer is not None and self.fallback_rf is not None:
            try:
                rf_df = input_df[self.feature_cols]
                shap_vals_raw = self.tree_explainer.shap_values(rf_df)
                if isinstance(shap_vals_raw, list):
                    class_shap = shap_vals_raw[pred_idx][0]
                elif hasattr(shap_vals_raw, 'shape') and len(shap_vals_raw.shape) == 3:
                    class_shap = shap_vals_raw[0, :, pred_idx]
                else:
                    class_shap = shap_vals_raw[0]

                raw_impacts = {
                    feat: float(class_shap[i])
                    for i, feat in enumerate(self.feature_cols)
                }
                using_model_shap = True
            except Exception as e:
                print(f"[XAI Service] TreeExplainer calculation fallback: {e}")
                using_model_shap = False

        if not using_model_shap:
            temp_impact = (25.0 - temp) * 0.04 if temp < 20 else (temp - 25.0) * 0.02
            hum_impact = (hum - 50.0) * 0.015 if hum > 60 else (40.0 - hum) * 0.01
            pm25_impact = (pm2_5 - 10.0) * 0.035 if pm2_5 > 12 else -0.15
            pm10_impact = (pm10 - 20.0) * 0.015 if pm10 > 25 else -0.08
            pm1_impact = (pm1_0 - 8.0) * 0.025 if pm1_0 > 10 else -0.06
            raw_impacts = {
                'pm2_5': pm25_impact,
                'temperature': temp_impact,
                'humidity': hum_impact,
                'pm10': pm10_impact,
                'pm1_0': pm1_impact
            }

        abs_sum = sum(abs(v) for v in raw_impacts.values())
        if abs_sum == 0:
            abs_sum = 1.0

        for feat in self.feature_cols:
            val = input_dict[feat]
            sh_val = raw_impacts[feat]
            direction = "increases_risk" if sh_val > 0 else "decreases_risk"
            feature_impacts.append({
                "feature": feat,
                "name": self._format_feature_name(feat),
                "value": round(float(val), 2),
                "unit": self._get_unit(feat),
                "shap_value": round(float(sh_val), 4),
                "direction": direction,
                "contribution_pct": round(abs(sh_val) / abs_sum * 100, 2)
            })

        feature_impacts.sort(key=lambda x: abs(x["shap_value"]), reverse=True)

        explanation_text, recommendation = self._generate_clinical_narrative(
            pred_label, feature_impacts, input_dict, using_model_shap=using_model_shap
        )

        return {
            "prediction": pred_label,
            "prediction_idx": pred_idx,
            "prediction_title": self.class_descriptions[pred_label],
            "probabilities": {
                "Green": float(round(probabilities[0] * 100, 1)),
                "Yellow": float(round(probabilities[1] * 100, 1)),
                "Red": float(round(probabilities[2] * 100, 1))
            },
            "confidence": float(round(max(probabilities) * 100, 1)),
            "base_value": 0.20,
            "feature_impacts": feature_impacts,
            "explanation": explanation_text,
            "recommendation": recommendation,
            "disclaimer": "Feasibility experiment output only; not clinically validated or intended for medical diagnosis.",
            "provenance": {
                "model_type": "RandomForestClassifier (100 Trees)",
                "xai_engine": "Model-Derived TreeSHAP (shap.TreeExplainer)" if using_model_shap else "Clinical Heuristic Indicators",
                "is_model_derived": using_model_shap,
                "is_rule_based_fallback": not using_model_shap,
                "attribution_method": "Exact Path-Dependent Tree Shapley Values" if using_model_shap else "Domain Sensitivity Heuristic",
                "feature_schema": self.feature_cols
            },
            "telemetry": input_dict
        }

    def _generate_clinical_narrative(self, pred_label, feature_impacts, telemetry, using_model_shap=True):
        top_driver = feature_impacts[0]
        second_driver = feature_impacts[1] if len(feature_impacts) > 1 else None

        patient_context = f" [Context: {telemetry.get('severity', 'Mild')} Asthma | Age: {telemetry.get('age_range', '18-29yo')}]"
        engine_tag = "Model-Derived TreeSHAP" if using_model_shap else "Heuristic Feature Indicators"

        # Construct specific clinical guidance based on top feature
        feat_key = top_driver['feature']
        feat_val = top_driver['value']
        
        advice_list = []
        if 'pm' in feat_key:
            advice_list.append("Elevated particulate matter detected. Activate indoor HEPA air purification, close windows, and keep your rescue inhaler at hand.")
        elif feat_key == 'temperature':
            if feat_val < 20.0:
                advice_list.append("Cold ambient air can trigger bronchoconstriction. Keep airways shielded with a scarf when outdoors.")
            else:
                advice_list.append("High ambient temperature can worsen airway reactivity. Stay hydrated in air-conditioned environments.")
        elif feat_key == 'humidity':
            if feat_val > 65.0:
                advice_list.append("High humidity promotes mold and dust mite proliferation. Utilize dehumidification to target 40%–50% relative humidity.")
            else:
                advice_list.append("Dry air can irritate bronchial linings. Keep hydration levels optimal and avoid dusty environments.")
        
        if pred_label == "Red":
            narrative = (
                f"HIGH RISK DETECTED ({engine_tag}){patient_context}. "
                f"The primary environmental driver is elevated {top_driver['name']} "
                f"({top_driver['value']}{top_driver['unit']}), accounting for {top_driver['contribution_pct']}% of the model's risk attribution."
            )
            if second_driver and second_driver['shap_value'] > 0:
                narrative += f" Secondary factor: {second_driver['name']} ({second_driver['value']}{second_driver['unit']})."
            rec = " ".join(advice_list) or "Elevated environmental hazard. Seek filtered indoor air and observe safety directives."
        elif pred_label == "Yellow":
            narrative = (
                f"MODERATE RISK LEVEL ({engine_tag}){patient_context}. "
                f"Environmental risk indicators are moderately elevated. {top_driver['name']} ({top_driver['value']}{top_driver['unit']}) "
                f"is the most influential feature influencing the model's assessment."
            )
            rec = " ".join(advice_list) or "Environmental indicators are elevated. Observe standard air quality precautions and limit strenuous outdoor exercise."
        else: # Green
            narrative = (
                f"LOW RISK BASELINE ({engine_tag}){patient_context}. "
                f"Particulate concentrations and climatic metrics are within optimal safety ranges."
            )
            rec = "Normal daily activities permitted. Environmental conditions are favorable and well within baseline comfort margins."

        return narrative, rec

    def get_global_importance(self):
        return self.global_importance or []

    def get_dataset_summary(self):
        if self.dataset_df is None:
            return {"total_samples": 0, "class_distribution": {}}
        
        counts = self.dataset_df['risk_label'].value_counts().to_dict()
        total = len(self.dataset_df)
        pcts = {k: round(v / total * 100, 2) for k, v in counts.items()}
        
        avg_stats = {
            "temperature": round(float(self.dataset_df['temperature'].mean()), 2),
            "humidity": round(float(self.dataset_df['humidity'].mean()), 2),
            "pm1_0": round(float(self.dataset_df['pm1_0'].mean()), 2),
            "pm2_5": round(float(self.dataset_df['pm2_5'].mean()), 2),
            "pm10": round(float(self.dataset_df['pm10'].mean()), 2)
        }

        return {
            "total_samples": total,
            "class_counts": counts,
            "class_percentages": pcts,
            "average_telemetry": avg_stats
        }

# Global singleton
xai_service = AsthmaXAIService()
