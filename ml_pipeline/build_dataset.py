"""
Asthma Risk Prediction Dataset Generator
=========================================
Grounded in:
1. University of Edinburgh AAMOS-00 Clinical Study Dataset (Nature Sci Data 2023)
2. IEEE Access (2021) "Machine Learning-Based Asthma Risk Prediction Using IoT and Smartphone Applications" (Bhat et al.)
3. Target Hardware Profile: DHT22 (Temp/RH) + PMS5003 (PM1.0, PM2.5, PM10) + ESP32

Output columns:
- timestamp
- temperature
- humidity
- pm1_0
- pm2_5
- pm10
- risk_label
"""

import os
import pandas as pd
import numpy as np

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_DATA_DIR = os.path.join(BASE_DIR, "datasets", "raw")
DEFAULT_OUTPUT_DIR = os.path.join(BASE_DIR, "datasets", "generated")

def generate_datasets(data_dir=None, output_dir=None):
    if data_dir is None:
        data_dir = DEFAULT_DATA_DIR
    if output_dir is None:
        output_dir = DEFAULT_OUTPUT_DIR
    os.makedirs(output_dir, exist_ok=True)

    print("=" * 60)
    print("Generating Asthma Risk ML Datasets...")
    print("=" * 60)

    # 1. Load source files
    env_path = os.path.join(data_dir, "anonym_aamos00_environment.csv")
    pf_path = os.path.join(data_dir, "anonym_aamos00_peakflow.csv")
    pat_path = os.path.join(data_dir, "anonym_aamos00_patient_info.csv")

    if not os.path.exists(env_path) or not os.path.exists(pf_path) or not os.path.exists(pat_path):
        raise FileNotFoundError(f"Source files not found in '{data_dir}'. Ensure AAMOS-00 files are extracted.")

    env_df = pd.read_csv(env_path)
    pf_df = pd.read_csv(pf_path)
    pat_df = pd.read_csv(pat_path)

    print(f"Loaded source tables:")
    print(f" - Environment rows: {len(env_df):,}")
    print(f" - Peak Flow rows:   {len(pf_df):,}")
    print(f" - Patient records:  {len(pat_df):,}")

    # 2. Merge Peak Flow readings with Environmental context on (user_key, date)
    merged = pd.merge(pf_df, env_df, on=['user_key', 'date'], how='inner')

    # 3. Incorporate Patient personal best PEF
    merged = pd.merge(
        merged,
        pat_df[['user_key', 'sex', 'age_range', 'pef_best', 'max_pef_expected', 'severity']],
        on='user_key',
        how='left'
    )

    # Fallback to empirical max PEF in study if pef_best baseline is missing for a user
    patient_max_pef = pf_df.groupby('user_key')['pef_max'].max().to_dict()
    merged['effective_pef_best'] = merged['pef_best'].fillna(merged['user_key'].map(patient_max_pef))

    # 4. Compute PEF percentage relative to personal best
    merged['pef_ratio'] = merged['pef_max'] / merged['effective_pef_best']

    # 5. Label risk according to standard clinical asthma action plan & IEEE 2021 paper thresholds:
    #    Green  (Safe): PEFR >= 80% of personal best
    #    Yellow (Moderate Risk): 50% <= PEFR < 80% of personal best
    #    Red    (High Risk): PEFR < 50% of personal best
    def assign_risk_label(ratio):
        if ratio >= 0.80:
            return 'Green'
        elif ratio >= 0.50:
            return 'Yellow'
        else:
            return 'Red'

    merged['risk_label'] = merged['pef_ratio'].apply(assign_risk_label)
    label_num_map = {'Green': 0, 'Yellow': 1, 'Red': 2}
    merged['risk_label_numeric'] = merged['risk_label'].map(label_num_map)

    # 6. Synthesize PM1.0 channel calibrated to PMS5003 laser sensor physics
    #    PM1.0 represents the sub-fraction of PM2.5 (fine/ultrafine aerosol, ~68-78% of PM2.5 in atmospheric air)
    np.random.seed(42)
    alpha = np.random.normal(0.72, 0.03, size=len(merged))
    merged['pm1_0'] = np.clip(np.round(merged['pm2_5'] * alpha, 2), 0.1, merged['pm2_5'])

    # 7. Generate formatted timestamps from study timeline (AAMOS-00 Phase 2: June 2021 start)
    study_start = pd.Timestamp("2021-06-01")
    merged['timestamp'] = (
        study_start + 
        pd.to_timedelta(merged['date'], unit='D') + 
        pd.to_timedelta(merged['hour'], unit='h')
    ).dt.strftime('%Y-%m-%d %H:%M:%S')

    # Round numeric environmental values for hardware consistency
    merged['temperature'] = merged['temperature'].round(2)
    merged['humidity'] = merged['humidity'].round(1)
    merged['pm2_5'] = merged['pm2_5'].round(2)
    merged['pm10'] = merged['pm10'].round(2)

    # 8. Clean null values in core features
    core_cols = ['timestamp', 'temperature', 'humidity', 'pm1_0', 'pm2_5', 'pm10', 'risk_label']
    clean_primary = merged.dropna(subset=['temperature', 'humidity', 'pm1_0', 'pm2_5', 'pm10', 'risk_label'])[core_cols].copy()
    clean_primary = clean_primary.sort_values('timestamp').reset_index(drop=True)

    # 9. Save primary dataset
    primary_csv = os.path.join(output_dir, "asthma_risk_dataset.csv")
    clean_primary.to_csv(primary_csv, index=False)
    print(f"\n[+] Successfully created primary dataset: '{primary_csv}' ({len(clean_primary):,} rows)")

    # 10. Extended dataset (with user_key, PEFR values, patient metadata for leakage-free validation)
    extended_cols = [
        'timestamp', 'user_key', 'date', 'hour', 'morning',
        'temperature', 'humidity', 'pressure', 'wind_speed', 'aqi',
        'pm1_0', 'pm2_5', 'pm10',
        'pef_max', 'effective_pef_best', 'pef_ratio',
        'sex', 'age_range', 'severity',
        'risk_label', 'risk_label_numeric'
    ]
    clean_extended = merged.dropna(subset=['temperature', 'humidity', 'pm1_0', 'pm2_5', 'pm10', 'risk_label'])[extended_cols].copy()
    clean_extended = clean_extended.sort_values(['user_key', 'date', 'hour']).reset_index(drop=True)
    extended_csv = os.path.join(output_dir, "asthma_risk_extended.csv")
    clean_extended.to_csv(extended_csv, index=False)
    print(f"[+] Successfully created extended dataset: '{extended_csv}' ({len(clean_extended):,} rows)")

    # 11. Daily Aggregated Dataset
    pf_daily = pf_df.groupby(['user_key', 'date']).agg(
        pef_max=('pef_max', 'max')
    ).reset_index()
    daily_merged = pd.merge(pf_daily, env_df, on=['user_key', 'date'], how='inner')
    daily_merged = pd.merge(daily_merged, pat_df[['user_key', 'pef_best']], on='user_key', how='left')
    daily_merged['effective_pef_best'] = daily_merged['pef_best'].fillna(daily_merged['user_key'].map(patient_max_pef))
    daily_merged['pef_ratio'] = daily_merged['pef_max'] / daily_merged['effective_pef_best']
    daily_merged['risk_label'] = daily_merged['pef_ratio'].apply(assign_risk_label)
    
    np.random.seed(42)
    daily_alpha = np.random.normal(0.72, 0.03, size=len(daily_merged))
    daily_merged['pm1_0'] = np.clip(np.round(daily_merged['pm2_5'] * daily_alpha, 2), 0.1, daily_merged['pm2_5'])
    daily_merged['timestamp'] = (study_start + pd.to_timedelta(daily_merged['date'], unit='D')).dt.strftime('%Y-%m-%d')
    
    daily_clean = daily_merged.dropna(subset=['temperature', 'humidity', 'pm1_0', 'pm2_5', 'pm10', 'risk_label'])[core_cols].copy()
    daily_clean = daily_clean.sort_values('timestamp').reset_index(drop=True)
    daily_csv = os.path.join(output_dir, "asthma_risk_daily.csv")
    daily_clean.to_csv(daily_csv, index=False)
    print(f"[+] Successfully created daily dataset: '{daily_csv}' ({len(daily_clean):,} rows)")

    print("\nTarget Label Breakdown (Primary Dataset):")
    print(clean_primary['risk_label'].value_counts(dropna=False))
    print((clean_primary['risk_label'].value_counts(normalize=True).round(4) * 100).astype(str) + '%')

    print("\nDataset Summary Statistics:")
    print(clean_primary.describe())

    return clean_primary

if __name__ == "__main__":
    generate_datasets()
