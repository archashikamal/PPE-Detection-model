# Backend — PPE Watch API

FastAPI service that loads the fine-tuned YOLOv8n model, runs detection on uploaded images/video frames, checks results against configured zones, and persists violations/settings to SQLite.

## Stack

- **FastAPI** + **Uvicorn** (ASGI server, with reload for dev)
- **Ultralytics YOLOv8** for inference
- **OpenCV** for frame decoding/cropping (thumbnails)
- **aiosqlite** for the SQLite database (no ORM — plain parameterized SQL in `database.py`)

---

## Local Setup

```bash
cd backend
python -m venv venv

# Windows:
.\venv\Scripts\Activate.ps1
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt

uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API docs (Swagger UI) are served at `http://localhost:8000/docs` once running.

Requires `../models/best.pt` to exist (see [`../models/README.md`](../models/README.md)) — the app fails to start without it.

---

## Environment Variables

Copy `.env.example` to `.env` to override defaults:

| Variable | Default | Description |
|:---|:---|:---|
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173,...` | Comma-separated list of allowed origins or `*` |
| `MODEL_PATH` | `../models/best.pt` | Path to YOLO checkpoint file |
| `DATABASE_PATH` | `ppe_compliance.db` | Path to SQLite database file |
| `UPLOAD_DIR` | `uploads` | Directory for uploaded videos and images |
| `THUMBNAIL_DIR` | `thumbnails` | Directory for violation snapshot crops |

---

## Docker

Build and run the standalone backend container:

```bash
# From project root
docker build -f backend/Dockerfile -t ppe-backend .
docker run -p 8000:8000 -v ppe_data:/app ppe-backend
```

---

## Directory Layout

```
backend/
├── main.py           # FastAPI app, lifespan (model load + DB init), CORS, router wiring
├── config.py         # Paths, class maps, default thresholds, environment variable loading
├── database.py       # All SQLite access (zones, violations, settings, stats, video_jobs)
├── detection.py      # Inference, person↔PPE association, zone/point-in-polygon logic
├── requirements.txt  # Python package dependencies
├── Dockerfile        # Container build definition
├── .env.example      # Environment variables template
├── routers/
│   ├── detect.py     # Image detection + video upload/job management
│   ├── ws.py         # WebSocket: frame-by-frame video streaming detection
│   ├── zones.py      # Zone CRUD + camera/site listing
│   ├── violations.py # Violation listing + CSV export
│   ├── dashboard.py  # Aggregated stats for the Dashboard page
│   └── settings.py   # Confidence threshold / sampling rate settings
├── thumbnails/       # Generated violation crop images (runtime, gitignored, has .gitkeep)
└── uploads/          # Uploaded video files (runtime, gitignored, has .gitkeep)
```

---

## Notes

- `ppe_compliance.db`, `thumbnails/`, and `uploads/` are created automatically on first run and are gitignored — they are runtime data, not source.
- Zones are scoped by a `camera_id` field (see the `Camera / Site` picker in the frontend) — a zone only applies to detections run with a matching `camera_id`. Defaults to `"default"` when not specified.
- CORS is configured dynamically via the `CORS_ORIGINS` environment variable.
