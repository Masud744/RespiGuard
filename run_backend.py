import sys
import os
import uvicorn

# Ensure root and backend directories are in the python path
root_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(root_dir, "backend")
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "0.0.0.0")
    is_prod = os.environ.get("ENVIRONMENT", "").lower() == "production" or os.environ.get("RENDER") is not None

    print("=" * 60)
    print(f"Starting RespiGuard XAI FastAPI Backend on http://{host}:{port}")
    print(f"Interactive API Docs: http://{host}:{port}/docs")
    print("=" * 60)

    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=not is_prod,
        reload_dirs=[backend_dir] if not is_prod else None,
        app_dir=backend_dir,
        timeout_graceful_shutdown=2
    )

