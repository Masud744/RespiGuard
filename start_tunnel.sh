#!/usr/bin/env bash
# ==============================================================================
# RespiGuard Cloudflare Public Tunnel Launcher
# ==============================================================================
echo "Starting Cloudflare Public Tunnel for RespiGuard API (Port 8000)..."
cloudflared tunnel --url http://127.0.0.1:8000
