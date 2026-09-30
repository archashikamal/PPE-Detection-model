# PPE Watch — AI Compliance Detection System

[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-009688?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18+-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev)
[![YOLOv8](https://img.shields.io/badge/YOLOv8-Ultralytics-00599C?style=flat&logo=yolo&logoColor=white)](https://docs.ultralytics.com)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.3+-38B2AC?style=flat&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat&logo=docker&logoColor=white)](https://www.docker.com)

A full-stack, real-time Personal Protective Equipment (PPE) compliance detection application designed for construction sites, manufacturing plants, and industrial safety monitoring. Powered by a fine-tuned **YOLOv8n** model trained to recognize 10 distinct classes of PPE gear, safety equipment, and safety violations.

---

## Architecture Overview

```
┌─────────────────────────────────┐                 ┌─────────────────────────────────┐
│     React 18 + Vite Frontend    │                 │      FastAPI Backend (Python)   │
│  - Live Monitor (HTML5 Canvas)  │  ◄──HTTP REST──►│  - YOLOv8n Inference Engine     │
│  - Zone Config (Polygon Drawer) │                 │  - Person-PPE Association (IoU) │
│  - Violations Log & Analytics   │◄──WebSocket(WS)►│  - Zone Compliance Checker      │
│  - Recharts Dashboard           │                 │  - SQLite (Violations & Stats)  │
└─────────────────────────────────┘                 └─────────────────────────────────┘
                                                                     │
                                                                 loads model
                                                                     ▼
                                                      ┌───────────────────────────────┐
                                                      │        models/best.pt         │
                                                      │  (Fine-tuned YOLOv8n weights) │
                                                      └───────────────────────────────┘
```

---

## Key Features

1. **Live Video & Image Detection**:
   - Upload images or `.mp4` video footage for automated inference.
   - Synchronized real-time bounding box overlay via WebSocket and HTML5 Canvas.
2. **Person-to-PPE Association**:
   - Associates helmets, masks, and vests to detected persons via bounding-box IoU (Intersection over Union).
   - Generates individual compliance cards for each worker in frame.
3. **Custom Polygon Safety Zones**:
   - Draw custom polygon hazard zones directly on video/camera frames.
   - Assign required PPE per zone (e.g., *Hardhat mandatory in Zone A; Masks required in Zone B*).
   - Scope zones to specific **Camera / Site** IDs.
4. **Automated Incident Logging**:
   - Crops and saves JPEG thumbnails of detected violators at the moment of infraction.
   - Records violations in an SQLite database with confidence, zone, and timestamp.
5. **Interactive Dashboard & Reporting**:
   - Visual compliance rate trends, violation distributions by class, and downloadable CSV audit reports.
6. **Configurable Thresholds**:
   - Adjust global or per-class detection confidence thresholds and video frame-sampling rates.

---

## Detected Classes

| Index | Class Name       | Category       | Description / Action                         |
|:-----:|:-----------------|:---------------|:---------------------------------------------|
| **0** | `Hardhat`        | PPE (Positive) | Safety helmet detected on head               |
| **1** | `Mask`           | PPE (Positive) | Protective face mask detected                |
| **2** | `NO-Hardhat`     | Violation      | Person head without required hardhat         |
| **3** | `NO-Mask`        | Violation      | Person face without required protective mask |
| **4** | `NO-Safety Vest` | Violation      | Person torso without high-visibility vest    |
| **5** | `Person`         | Entity         | Human worker entity                          |
| **6** | `Safety Cone`    | Environment    | Hazardous boundary traffic cone              |
| **7** | `Safety Vest`    | PPE (Positive) | High-visibility reflective vest              |
| **8** | `machinery`      | Environment    | Heavy equipment (excavators, cranes, etc.)   |
| **9** | `vehicle`        | Environment    | Work trucks, cars, mixers                    |

---

## Repository Structure

```
PPE project/
├── backend/                  # FastAPI backend service
│   ├── config.py             # Environment configurations and class maps
│   ├── database.py           # SQLite operations (aiosqlite)
│   ├── detection.py          # YOLO inference, IoU matching, polygon checks
│   ├── main.py               # FastAPI app, lifespan, CORS, and routers
│   ├── requirements.txt      # Python dependencies
│   ├── Dockerfile            # Container definition for backend
│   ├── .env.example          # Environment variables template
│   ├── routers/              # Modular API endpoints
│   │   ├── dashboard.py      # Analytics & compliance summary
│   │   ├── detect.py         # Image & video processing endpoints
│   │   ├── settings.py       # Detection parameters & thresholds
│   │   ├── violations.py     # Incident queries & CSV exports
│   │   ├── ws.py             # WebSocket video stream handler
│   │   └── zones.py          # Polygon safety zone CRUD
│   ├── thumbnails/           # Auto-saved violation crops (runtime data)
│   └── uploads/              # Uploaded videos/images (runtime data)
│
├── frontend/                 # Vite React frontend application
│   ├── src/                  # React source components & pages
│   │   ├── api/client.js     # Axios API & WebSocket clients
│   │   ├── config/           # API URLs and class color palettes
│   │   ├── pages/            # Dashboard, LiveMonitor, ZoneConfig, etc.
│   │   └── components/       # Layout, StatCard, Toasts, etc.
│   ├── package.json          # Node dependencies & build scripts
│   ├── Dockerfile            # Multi-stage production container
│   ├── nginx.conf            # Nginx SPA routing configuration
│   ├── .env.example          # Frontend environment variables template
│   └── vite.config.js        # Vite bundling configuration
│
├── models/                   # Model weight checkpoints
│   ├── best.pt               # Fine-tuned YOLOv8n model weights (committed)
│   └── README.md             # Model details & usage notes
│
├── training/                 # Model training records & evaluation plots
│   ├── confusion_matrix.png  # Classification confusion matrix
│   ├── results.png           # Loss and mAP curves across epochs
│   └── README.md             # Training hyperparameters & metrics
│
├── docs/                     # Project documentation
│   └── SETTINGS.md           # Detection settings & threshold guide
│
├── docker-compose.yml        # Orchestration for full-stack local/server deployment
├── .env.example              # Root environment template
└── .gitignore                # Git ignore configuration
```

---

## Prerequisites

- **Python**: 3.10 or 3.11
- **Node.js**: 18+ and `npm`
- **Docker & Docker Compose** *(Optional, for containerized run)*

---

## Local Development Setup

### 1. Clone & Setup Backend

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# Windows (CMD):
venv\Scripts\activate.bat
# Linux / macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start backend server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be live at `http://localhost:8000`.  
Interactive Swagger documentation is available at `http://localhost:8000/docs`.

### 2. Setup Frontend

Open a new terminal window:

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```

Open your browser at **`http://localhost:5173`**.

---

## Running with Docker Compose (Recommended)

Run both the backend and frontend with a single command:

```bash
# From the project root
docker compose up --build
```

- **Frontend**: `http://localhost:5173`
- **Backend API**: `http://localhost:8000`
- **API Docs**: `http://localhost:8000/docs`

All runtime databases (`ppe_compliance.db`) and violation snapshots are automatically persisted in a named Docker volume (`backend_data`).

---

## Deployment Guide

### Option A: Cloud Container Platforms (Render, Railway, Fly.io)

1. **Deploy Backend**:
   - Connect your GitHub repository to Render/Railway.
   - Choose **Docker** or **Python** environment with root directory `backend/`.
   - Set environment variables:
     ```env
     CORS_ORIGINS=https://your-frontend-domain.vercel.app
     ```
   - **Persistent Storage**: Mount a persistent disk to `/app` (or configure paths for `ppe_compliance.db` and `thumbnails/`) so violations and history persist across restarts.

2. **Deploy Frontend (Vercel, Netlify, or Render Static)**:
   - Connect the same repository and select the `frontend/` directory.
   - Build command: `npm run build`
   - Output directory: `dist`
   - Set environment variable:
     ```env
     VITE_API_BASE=https://your-backend-api.onrender.com
     VITE_WS_BASE=wss://your-backend-api.onrender.com
     ```

### Option B: Self-Hosted Linux Server / VPS (AWS EC2, DigitalOcean, Ubuntu)

1. Clone your repo onto the server:
   ```bash
   git clone https://github.com/your-username/ppe-watch.git
   cd ppe-watch
   ```
2. Copy `.env.example` to `.env` and fill in your server's domain/IP:
   ```bash
   cp .env.example .env
   ```
3. Run with Docker Compose:
   ```bash
   docker compose up -d --build
   ```

---

## Pushing to GitHub (Step-by-Step)

To upload this project to your GitHub account:

```bash
# 1. Initialize git in the project root (if not already initialized)
git init

# 2. Add all project files
git add .

# 3. Create your first commit
git commit -m "feat: complete PPE compliance detection system with Docker and deployment configs"

# 4. Create a new repository on GitHub (e.g. ppe-watch)
# Then link your local repository:
git branch -M main
git remote add origin https://github.com/<YOUR-USERNAME>/<YOUR-REPO-NAME>.git

# 5. Push to GitHub
git push -u origin main
```

---

## Environment Variables Reference

| Variable | Scope | Default | Description |
|:---|:---|:---|:---|
| `VITE_API_BASE` | Frontend | `http://localhost:8000` | HTTP API URL of the backend |
| `VITE_WS_BASE` | Frontend | `ws://localhost:8000` | WebSocket base URL for video streaming |
| `CORS_ORIGINS` | Backend | `http://localhost:5173,...` | Comma-separated list of allowed origins |
| `MODEL_PATH` | Backend | `../models/best.pt` | Path to YOLO checkpoint file |
| `DATABASE_PATH` | Backend | `ppe_compliance.db` | Path to SQLite database file |
| `UPLOAD_DIR` | Backend | `uploads` | Directory for uploaded videos and images |
| `THUMBNAIL_DIR` | Backend | `thumbnails` | Directory for violation snapshot crops |

---

## License

Internal project — developed for workplace safety and compliance monitoring.
