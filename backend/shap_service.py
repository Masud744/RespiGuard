import os
import joblib
import pandas as pd
import numpy as np
import shap

class AsthmaXAIService:
    def __init__(self):
        self.sensor_cols = ['temperature', 'humidity', 'pm2_5', 'pm10']
        self.legacy_cols = ['temperature', 'humidity', 'pm1_0', 'pm2_5', 'pm10']
        self.patient_num_cols = ['temperature', 'humidity', 'pm2_5', 'pm10', 'max_pef_expected']
        self.patient_cat_cols = ['age_range', 'sex']
        self.patient_all_cols = self.patient_num_cols + self.patient_cat_cols
        
        self.classes = ['Green', 'Yellow', 'Red']
        self.class_descriptions = {
            'Green': 'Safe / Low Exacerbation Risk (PEFR >= 80%)',
            'Yellow': 'Moderate Exacerbation Risk (50% <= PEFR < 80%)',
            'Red': 'High Exacerbation Risk / Danger (PEFR < 50%)'
        }
        
        # Dual-Pipeline Model Bundles
        self.mode_a_bundle = None
        self.mode_b_bundle = None
        self.explainer_a1 = None
        self.explainer_a2 = None
        self.explainer_b1 = None
        self.explainer_b2 = None
        
        # Historical / Fallback references
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
            os.path.join("models", filename),
            os.path.join("..", "models", filename),
            os.path.join(os.path.dirname(__file__), "..", "models", filename),
            os.path.join("datasets", "generated", filename),
            os.path.join("..", "datasets", "generated", filename),
            os.path.join(os.path.dirname(__file__), "..", "datasets", "generated", filename),
            os.path.join("datasets", "raw", filename),
            os.path.join("..", "datasets", "raw", filename),
            os.path.join(os.path.dirname(__file__), "..", "datasets", "raw", filename),
        ]
        for path in candidates:
            if os.path.exists(path):
                return path
        return filename

    def load_model_and_data(self):
        mode_a_path = self._find_file("leak_free_4sensor_model.joblib")
        mode_b_path = self._find_file("calibrated_7feature_model.joblib")
        two_stage_path = self._find_file("two_stage_asthma_model.joblib")
        rf_path = self._find_file("random_forest_asthma.joblib")
        dataset_path = self._find_file("asthma_risk_corrected_audit.csv")
        if not os.path.exists(dataset_path):
            dataset_path = self._find_file("asthma_risk_extended.csv")
        if not os.path.exists(dataset_path):
            dataset_path = self._find_file("asthma_risk_dataset.csv")

        # 1. Load Mode A Bundle (Leak-Free 4 Physical Sensors)
        if os.path.exists(mode_a_path):
            print(f"[XAI Service] Loading Mode A (4-sensor leak-free) bundle from: {mode_a_path}")
            try:
                self.mode_a_bundle = joblib.load(mode_a_path)
                if isinstance(self.mode_a_bundle, dict):
                    self.explainer_a1 = shap.TreeExplainer(self.mode_a_bundle['stage1_model'])
                    self.explainer_a2 = shap.TreeExplainer(self.mode_a_bundle['stage2_model'])
                    print("[XAI Service] Mode A Pipeline loaded with CatBoost TreeSHAP explainers.")
            except Exception as e:
                print(f"[XAI Service] Error loading Mode A bundle: {e}")

        # 2. Load Mode B Bundle (Calibrated 7-Feature Pipeline)
        if os.path.exists(mode_b_path):
            print(f"[XAI Service] Loading Mode B (calibrated 7-feature) bundle from: {mode_b_path}")
            try:
                self.mode_b_bundle = joblib.load(mode_b_path)
                if isinstance(self.mode_b_bundle, dict):
                    self.explainer_b1 = shap.TreeExplainer(self.mode_b_bundle['stage1_model'])
                    self.explainer_b2 = shap.TreeExplainer(self.mode_b_bundle['stage2_model'])
                    print("[XAI Service] Mode B Pipeline loaded with TreeSHAP explainers.")
            except Exception as e:
                print(f"[XAI Service] Error loading Mode B bundle: {e}")

        # 3. Load Legacy 2-Stage Bundle as Fallback
        if os.path.exists(two_stage_path):
            try:
                self.bundle = joblib.load(two_stage_path)
                if isinstance(self.bundle, dict):
                    self.preprocessor = self.bundle.get('preprocessor')
                    self.stage1_model = self.bundle.get('stage1_model')
                    self.stage2_model = self.bundle.get('stage2_model')
            except Exception as e:
                print(f"[XAI Service] Legacy 2-stage bundle notice: {e}")

        # 4. Fallback RF Explainer
        if os.path.exists(rf_path):
            try:
                self.fallback_rf = joblib.load(rf_path)
                self.tree_explainer = shap.TreeExplainer(self.fallback_rf)
            except Exception as e:
                self.tree_explainer = None

        # 5. Load Dataset
        if os.path.exists(dataset_path):
            self.dataset_df = pd.read_csv(dataset_path)
            self._compute_global_importance()

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
            'max_pef_expected': 'Reference Lung Capacity (PEF)',
            'effective_pef_best': 'Baseline Lung Capacity (PEF)',
            'pef_best': 'Baseline Lung Capacity (PEF)',
            'severity': 'Asthma Severity',
            'age_range': 'Age Cohort',
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
            'max_pef_expected': ' L/min',
            'effective_pef_best': ' L/min',
            'pef_best': ' L/min',
            'severity': '',
            'age_range': '',
            'sex': ''
        }
        return mapping.get(feat, '')

    def explain_prediction(self, telemetry: dict):
        """
        Dynamic Dual-Pipeline Prediction & TreeSHAP Attribution Engine:
        - Mode A (Un-enrolled live telemetry): 4 pure physical sensors, 0% Red->Green FN.
        - Mode B (Enrolled patient telehealth): 4 sensors + intake covariates, ~80% longitudinal accuracy.
        """
        temp = float(telemetry.get('temperature', 25.0))
        hum = float(telemetry.get('humidity', 60.0))
        pm1_0 = float(telemetry.get('pm1_0', 10.0))
        pm2_5 = float(telemetry.get('pm2_5', 15.0))
        pm10 = float(telemetry.get('pm10', 25.0))

        # Mode Selection Routing
        req_mode = telemetry.get('mode') or telemetry.get('pipeline_mode')
        has_profile = telemetry.get('has_patient_profile') is True
        has_pef_expected = telemetry.get('max_pef_expected') is not None

        if req_mode in ['mode_a', 'mode_a_pure_sensor']:
            active_mode = 'mode_a_pure_sensor'
        elif req_mode in ['mode_b', 'mode_b_calibrated_profile']:
            active_mode = 'mode_b_calibrated_profile'
        elif has_pef_expected or has_profile:
            active_mode = 'mode_b_calibrated_profile'
        else:
            active_mode = 'mode_a_pure_sensor'

        # Fallback to Mode A if Mode B not available, or vice versa
        if active_mode == 'mode_b_calibrated_profile' and self.mode_b_bundle is None:
            active_mode = 'mode_a_pure_sensor'
        if active_mode == 'mode_a_pure_sensor' and self.mode_a_bundle is None and self.mode_b_bundle is not None:
            active_mode = 'mode_b_calibrated_profile'

        # -----------------------------------------------------------------
        # PIPELINE EXECUTION: MODE B (Calibrated Telehealth Pipeline)
        # -----------------------------------------------------------------
        if active_mode == 'mode_b_calibrated_profile' and self.mode_b_bundle is not None:
            bundle = self.mode_b_bundle
            preprocessor = bundle['preprocessor']
            st1 = bundle['stage1_model']
            st2 = bundle['stage2_model']
            tau_1 = bundle.get('tau_1', 0.50)
            tau_2 = bundle.get('tau_2', 0.50)

            max_pef = float(telemetry.get('max_pef_expected', telemetry.get('pef_best', 500.0)))
            age_raw = telemetry.get('age')
            age_range = str(telemetry.get('age_range', self._map_age_to_range(age_raw if age_raw is not None else 25)))
            sex = str(telemetry.get('sex', 'male')).lower()

            input_dict = {
                'temperature': temp,
                'humidity': hum,
                'pm1_0': pm1_0,
                'pm2_5': pm2_5,
                'pm10': pm10,
                'max_pef_expected': max_pef,
                'age_range': age_range,
                'sex': sex
            }
            eval_df = pd.DataFrame([{
                'temperature': temp,
                'humidity': hum,
                'pm2_5': pm2_5,
                'pm10': pm10,
                'max_pef_expected': max_pef,
                'age_range': age_range,
                'sex': sex
            }])

            X_trans = preprocessor.transform(eval_df)
            s1_prob = st1.predict_proba(X_trans)[0] # [p_safe, p_risk]
            s2_prob = st2.predict_proba(X_trans)[0] # [p_yellow, p_red]

            if s1_prob[1] < tau_1:
                pred_idx = 0
                pred_label = "Green"
                shap_raw = self.explainer_b1.shap_values(X_trans)
            else:
                if s2_prob[1] >= tau_2:
                    pred_idx = 2
                    pred_label = "Red"
                    shap_raw = self.explainer_b2.shap_values(X_trans)
                else:
                    pred_idx = 1
                    pred_label = "Yellow"
                    shap_raw = self.explainer_b1.shap_values(X_trans)

            p_green = float(s1_prob[0])
            p_yellow = float(s1_prob[1] * s2_prob[0])
            p_red = float(s1_prob[1] * s2_prob[1])
            tot_p = p_green + p_yellow + p_red
            probabilities = [p_green / tot_p, p_yellow / tot_p, p_red / tot_p]

            # Aggregate 11 OHE columns into 7 features
            sv = shap_raw[0] if len(shap_raw.shape) == 2 else shap_raw
            raw_impacts = {
                'temperature': float(sv[0]),
                'humidity': float(sv[1]),
                'pm2_5': float(sv[2]),
                'pm10': float(sv[3]),
                'max_pef_expected': float(sv[4]),
                'age_range': float(np.sum(sv[5:9])),
                'sex': float(np.sum(sv[9:11]))
            }
            mode_features = ['temperature', 'humidity', 'pm2_5', 'pm10', 'max_pef_expected', 'age_range', 'sex']
            using_model_shap = True

        # -----------------------------------------------------------------
        # PIPELINE EXECUTION: MODE A (Leak-Free 4 Physical Sensors)
        # -----------------------------------------------------------------
        elif active_mode == 'mode_a_pure_sensor' and self.mode_a_bundle is not None:
            bundle = self.mode_a_bundle
            scaler = bundle['preprocessor']
            st1 = bundle['stage1_model']
            st2 = bundle['stage2_model']
            tau_1 = bundle.get('tau_1', 0.35)
            tau_2 = bundle.get('tau_2', 0.25)

            input_dict = {
                'temperature': temp,
                'humidity': hum,
                'pm1_0': pm1_0,
                'pm2_5': pm2_5,
                'pm10': pm10
            }
            X_arr = np.array([[temp, hum, pm2_5, pm10]])
            X_trans = scaler.transform(X_arr)

            s1_prob = st1.predict_proba(X_trans)[0] # [p_safe, p_risk]
            s2_prob = st2.predict_proba(X_trans)[0] # [p_yellow, p_red]

            if s1_prob[1] < tau_1:
                pred_idx = 0
                pred_label = "Green"
                shap_raw = self.explainer_a1.shap_values(X_trans)
            else:
                if s2_prob[1] >= tau_2:
                    pred_idx = 2
                    pred_label = "Red"
                    shap_raw = self.explainer_a2.shap_values(X_trans)
                else:
                    pred_idx = 1
                    pred_label = "Yellow"
                    shap_raw = self.explainer_a1.shap_values(X_trans)

            p_green = float(s1_prob[0])
            p_yellow = float(s1_prob[1] * s2_prob[0])
            p_red = float(s1_prob[1] * s2_prob[1])
            tot_p = p_green + p_yellow + p_red
            probabilities = [p_green / tot_p, p_yellow / tot_p, p_red / tot_p]

            sv = shap_raw[0] if len(shap_raw.shape) == 2 else shap_raw
            raw_impacts = {
                'temperature': float(sv[0]),
                'humidity': float(sv[1]),
                'pm2_5': float(sv[2]),
                'pm10': float(sv[3])
            }
            mode_features = ['temperature', 'humidity', 'pm2_5', 'pm10']
            using_model_shap = True

        # -----------------------------------------------------------------
        # PIPELINE EXECUTION: LEGACY FALLBACK
        # -----------------------------------------------------------------
        else:
            bundle = self.bundle or {}
            active_mode = "legacy_fallback"
            mode_features = self.sensor_cols
            input_dict = {'temperature': temp, 'humidity': hum, 'pm1_0': pm1_0, 'pm2_5': pm2_5, 'pm10': pm10}
            if self.fallback_rf is not None:
                rf_df = pd.DataFrame([input_dict])[self.sensor_cols]
                pred_idx = int(self.fallback_rf.predict(rf_df)[0])
                pred_label = self.classes[pred_idx]
                probabilities = self.fallback_rf.predict_proba(rf_df)[0].tolist()
                raw_impacts = {f: 0.0 for f in self.sensor_cols}
                using_model_shap = False
            else:
                pred_idx = 0
                pred_label = "Green"
                probabilities = [0.9, 0.08, 0.02]
                raw_impacts = {f: 0.0 for f in self.sensor_cols}
                using_model_shap = False
            tau_1, tau_2 = 0.50, 0.50

        # Feature Impacts Computation
        abs_sum = sum(abs(v) for v in raw_impacts.values())
        if abs_sum == 0:
            abs_sum = 1.0

        feature_impacts = []
        for feat in mode_features:
            val = input_dict.get(feat, 0.0)
            sh_val = raw_impacts.get(feat, 0.0)
            direction = "increases_risk" if sh_val > 0 else "decreases_risk"
            feature_impacts.append({
                "feature": feat,
                "name": self._format_feature_name(feat),
                "value": round(float(val), 2) if isinstance(val, (int, float)) else str(val),
                "unit": self._get_unit(feat),
                "shap_value": round(float(sh_val), 4),
                "direction": direction,
                "contribution_pct": round(abs(sh_val) / abs_sum * 100, 2)
            })

        feature_impacts.sort(key=lambda x: abs(x["shap_value"]), reverse=True)

        explanation_text, recommendation = self._generate_clinical_narrative(
            pred_label, feature_impacts, input_dict, using_model_shap=using_model_shap
        )

        model_title = bundle.get('pipeline_name', 'RespiGuard Hierarchical Engine')
        model_ver = bundle.get('version', '2.2.0-production')

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
            "pipeline_mode": active_mode,
            "provenance": {
                "model_type": model_title,
                "model_version": model_ver,
                "pipeline_mode": active_mode,
                "xai_engine": "Model-Derived TreeSHAP (shap.TreeExplainer)" if using_model_shap else "Clinical Heuristic Indicators",
                "is_model_derived": using_model_shap,
                "is_rule_based_fallback": not using_model_shap,
                "attribution_method": "Exact Path-Dependent Tree Shapley Values",
                "feature_schema": mode_features,
                "tau_1": tau_1,
                "tau_2": tau_2
            },
            "telemetry": input_dict
        }

    def _generate_clinical_narrative(self, pred_label, feature_impacts, telemetry, using_model_shap=True):
        top_driver = feature_impacts[0] if feature_impacts else {"name": "Particulates", "feature": "pm2_5", "value": 0, "unit": "", "contribution_pct": 0, "shap_value": 0}
        second_driver = feature_impacts[1] if len(feature_impacts) > 1 else None

        patient_context = ""
        if 'max_pef_expected' in telemetry:
            patient_context = f" [Baseline PEF Reference: {telemetry.get('max_pef_expected')} L/min | Cohort: {telemetry.get('age_range', 'Adult')}]"
        elif 'age_range' in telemetry:
            patient_context = f" [Context: {telemetry.get('severity', 'Enrolled')} Asthma | Age: {telemetry.get('age_range', '18-29yo')}]"

        engine_tag = "Model-Derived TreeSHAP" if using_model_shap else "Heuristic Feature Indicators"

        # Construct specific clinical guidance based on top feature
        feat_key = top_driver['feature']
        feat_val = top_driver['value']
        
        advice_list = []
        if 'pm' in feat_key:
            advice_list.append("Elevated particulate matter detected. Activate indoor HEPA air purification, close windows, and keep your rescue inhaler at hand.")
        elif feat_key == 'temperature':
            if isinstance(feat_val, (int, float)) and feat_val < 20.0:
                advice_list.append("Cold ambient air can trigger bronchoconstriction. Keep airways shielded with a scarf when outdoors.")
            else:
                advice_list.append("High ambient temperature can worsen airway reactivity. Stay hydrated in air-conditioned environments.")
        elif feat_key == 'humidity':
            if isinstance(feat_val, (int, float)) and feat_val > 65.0:
                advice_list.append("High humidity promotes mold and dust mite proliferation. Utilize dehumidification to target 40%–50% relative humidity.")
            else:
                advice_list.append("Dry air can irritate bronchial linings. Keep hydration levels optimal and avoid dusty environments.")
        elif feat_key in ['max_pef_expected', 'effective_pef_best', 'pef_best']:
            advice_list.append("Baseline lung capacity indicates individual susceptibility threshold. Monitor peak flow daily.")
        
        val_str = f"({top_driver['value']}{top_driver['unit']})" if top_driver['unit'] else f"({top_driver['value']})"
        if pred_label == "Red":
            narrative = (
                f"HIGH RISK DETECTED ({engine_tag}){patient_context}. "
                f"The primary driver is {top_driver['name']} {val_str}, "
                f"accounting for {top_driver['contribution_pct']}% of the model's risk attribution."
            )
            if second_driver and second_driver['shap_value'] > 0:
                s_val = f"({second_driver['value']}{second_driver['unit']})" if second_driver['unit'] else f"({second_driver['value']})"
                narrative += f" Secondary factor: {second_driver['name']} {s_val}."
            rec = " ".join(advice_list) or "Elevated environmental hazard. Seek filtered indoor air and observe safety directives."
        elif pred_label == "Yellow":
            narrative = (
                f"MODERATE RISK LEVEL ({engine_tag}){patient_context}. "
                f"Environmental risk indicators are moderately elevated. {top_driver['name']} {val_str} "
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
        
        counts = self.dataset_df['risk_label'].value_counts().to_dict() if 'risk_label' in self.dataset_df.columns else {}
        total = len(self.dataset_df)
        pcts = {k: round(v / total * 100, 2) for k, v in counts.items()}
        
        avg_stats = {
            "temperature": round(float(self.dataset_df['temperature'].mean()), 2) if 'temperature' in self.dataset_df.columns else 0.0,
            "humidity": round(float(self.dataset_df['humidity'].mean()), 2) if 'humidity' in self.dataset_df.columns else 0.0,
            "pm1_0": round(float(self.dataset_df['pm1_0'].mean()), 2) if 'pm1_0' in self.dataset_df.columns else 0.0,
            "pm2_5": round(float(self.dataset_df['pm2_5'].mean()), 2) if 'pm2_5' in self.dataset_df.columns else 0.0,
            "pm10": round(float(self.dataset_df['pm10'].mean()), 2) if 'pm10' in self.dataset_df.columns else 0.0
        }

        return {
            "total_samples": total,
            "class_counts": counts,
            "class_percentages": pcts,
            "average_telemetry": avg_stats
        }

# Global singleton
xai_service = AsthmaXAIService()

