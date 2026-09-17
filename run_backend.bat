@echo off
title RespiGuard FastAPI Backend Service
echo ===================================================
echo Starting FastAPI Backend with TreeSHAP Explainer...
echo ===================================================
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
pause
