from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from ultralytics import YOLO
import os
import contextlib

from database import init_db
from config import MODEL_PATH, THUMBNAIL_DIR, UPLOAD_DIR
from routers import detect, zones, violations, dashboard, settings, ws

@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    
    # Ensure dirs exist
    os.makedirs(THUMBNAIL_DIR, exist_ok=True)
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    
    # Load model
    print(f"Loading YOLO model from {MODEL_PATH}")
    app.state.model = YOLO(MODEL_PATH)
    
    yield
    # Shutdown
    pass

app = FastAPI(title="PPE Compliance Detection API", lifespan=lifespan)

# Configure CORS
cors_origins_env = os.getenv("CORS_ORIGINS", "")
if cors_origins_env.strip():
    allow_origins = [orig.strip() for orig in cors_origins_env.split(",") if orig.strip()]
else:
    allow_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8080",
    ]

allow_creds = "*" not in allow_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=allow_creds,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/thumbnails", StaticFiles(directory=THUMBNAIL_DIR), name="thumbnails")
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.include_router(detect.router)
app.include_router(ws.ws_router)
app.include_router(zones.router)
app.include_router(violations.router)
app.include_router(dashboard.router)
app.include_router(settings.router)

@app.get("/")
async def root():
    return {"status": "running", "model": "YOLOv8n PPE Detection"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
