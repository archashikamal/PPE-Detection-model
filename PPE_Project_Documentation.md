# PPE Watch — AI Compliance Detection System
## Comprehensive Project Documentation

---

## 1. Project Overview

**PPE Watch** is a full-stack, real-time Personal Protective Equipment (PPE) compliance detection system built for industrial safety monitoring in construction sites, manufacturing plants, and similar environments. It uses a fine-tuned **YOLOv8n** deep-learning model to automatically detect whether workers are wearing required safety gear — and flags violations instantly.

### Core Capabilities

| Capability | Description |
|---|---|
| Real-time PPE Detection | Analyze uploaded images and videos for PPE compliance |
| Person-level Compliance | Links PPE items to individual workers via bounding box IoU matching |
| Zone-based Enforcement | Draw custom polygon zones with per-zone PPE requirements |
| Automated Incident Logging | Saves violation records with JPEG thumbnail crops to SQLite |
| Live Streaming Dashboard | WebSocket-driven real-time overlays while video processes |
| Configurable Sensitivity | Global and per-class confidence thresholds + frame sampling rate |
| CSV Export | Download the full violations log as an audit report |

---

## 2. System Architecture

```
┌──────────────────────────────────────────┐         ┌──────────────────────────────────────────┐
│         React 18 + Vite Frontend          │         │        FastAPI Backend (Python 3.11)      │
│                                          │         │                                           │
│  ┌─────────────┐  ┌──────────────────┐  │ HTTP    │  ┌────────────────────────────────────┐  │
│  │  Dashboard  │  │  Violations Log  │  │◄──────►│  │   YOLOv8n Inference (Ultralytics)  │  │
│  └─────────────┘  └──────────────────┘  │ REST    │  └────────────────────────────────────┘  │
│  ┌─────────────┐  ┌──────────────────┐  │         │  ┌────────────────────────────────────┐  │
│  │ LiveMonitor │  │   ZoneConfig     │  │◄──WS──►│  │  Person-PPE IoU Association        │  │
│  └─────────────┘  └──────────────────┘  │         │  └────────────────────────────────────┘  │
│  ┌─────────────┐                        │         │  ┌────────────────────────────────────┐  │
│  │  Settings   │  Axios + WebSocket API │         │  │  Zone Compliance (Ray-Casting)     │  │
│  └─────────────┘                        │         │  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘         │  ┌────────────────────────────────────┐  │
                                                     │  │  SQLite Database (aiosqlite)       │  │
                                                     │  └────────────────────────────────────┘  │
                                                     └──────────────────────────────────────────┘
                                                                          │
                                                                     loads model
                                                                          ▼
                                                          ┌───────────────────────────┐
                                                          │      models/best.pt       │
                                                          │  Fine-tuned YOLOv8n       │
                                                          └───────────────────────────┘
```

**Communication Protocols:**
- **HTTP REST** — for image upload, zone CRUD, violations query, settings, dashboard stats
- **WebSocket** — for real-time per-frame detection streaming during video processing

---

## 3. Technology Stack

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Python | 3.10 / 3.11 | Runtime |
| FastAPI | ≥0.104.0 | Async web framework & REST API |
| Uvicorn | ≥0.24.0 | ASGI server |
| Ultralytics (YOLOv8) | ≥8.0.0 | Object detection inference engine |
| OpenCV (`opencv-python-headless`) | ≥4.8.0 | Video/image decoding, thumbnail cropping |
| aiosqlite | ≥0.19.0 | Async SQLite ORM |
| Pillow | ≥10.0.0 | Image utilities |
| NumPy | ≥1.24.0 | Array operations for bounding boxes |
| python-multipart | ≥0.0.6 | File upload form parsing |

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 18.x | UI library |
| Vite | 5.x | Build tool & dev server |
| React Router DOM | 6.x | SPA routing |
| Axios | 1.x | HTTP client |
| Recharts | 2.x | Dashboard charts |
| Lucide React | 0.294+ | Icon components |
| TailwindCSS | 3.3+ | Utility-first styling |

### Infrastructure
| Technology | Purpose |
|---|---|
| Docker & Docker Compose | Containerized deployment |
| Nginx | Frontend static file serving + SPA routing in production |
| SQLite | Embedded database (no external DB server required) |

---

## 4. Repository Structure

```
PPE project/
├── backend/                     # FastAPI backend service
│   ├── main.py                  # App entry point: CORS, lifespan, router registration
│   ├── config.py                # Class maps, paths, default thresholds
│   ├── database.py              # All async SQLite operations (aiosqlite)
│   ├── detection.py             # YOLO inference, IoU matching, zone polygon checks
│   ├── requirements.txt         # Python package dependencies
│   ├── Dockerfile               # Backend container definition
│   ├── .env.example             # Environment variable template
│   ├── ppe_compliance.db        # SQLite database (auto-created at runtime)
│   ├── thumbnails/              # Auto-saved violation JPEG crops (runtime)
│   ├── uploads/                 # Uploaded video/image files (runtime)
│   └── routers/
│       ├── __init__.py
│       ├── detect.py            # POST /api/detect/image and /video, job management
│       ├── ws.py                # WebSocket /ws/video-stream/{job_id}
│       ├── zones.py             # CRUD /api/zones
│       ├── violations.py        # GET/DELETE/export /api/violations
│       ├── dashboard.py         # GET /api/compliance-summary
│       └── settings.py          # GET/PUT /api/settings
│
├── frontend/                    # Vite + React frontend
│   ├── src/
│   │   ├── App.jsx              # Root component with React Router routes
│   │   ├── main.jsx             # React DOM render entry point
│   │   ├── index.css            # Global CSS & Tailwind imports
│   │   ├── api/
│   │   │   └── client.js        # Axios instance + all API call functions + WS connector
│   │   ├── config/
│   │   │   └── constants.js     # API_BASE, WS_BASE, class names, colors
│   │   ├── components/
│   │   │   ├── Layout.jsx       # App shell: sidebar nav + <Outlet>
│   │   │   ├── StatCard.jsx     # Reusable KPI card component
│   │   │   ├── EmptyState.jsx   # Empty/error placeholder UI
│   │   │   └── Toast.jsx        # Toast notification system (Context + hook)
│   │   └── pages/
│   │       ├── Dashboard.jsx    # Analytics overview with Recharts
│   │       ├── LiveMonitor.jsx  # File upload, video/image detection, canvas overlay
│   │       ├── ZoneConfig.jsx   # Interactive polygon zone drawing on canvas
│   │       ├── ViolationsLog.jsx # Paginated violations table with filters & CSV export
│   │       └── Settings.jsx     # Detection threshold sliders
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── nginx.conf               # Nginx config for SPA routing in production
│   ├── Dockerfile               # Multi-stage build: Node → Nginx
│   └── .env.example
│
├── models/
│   ├── best.pt                  # Fine-tuned YOLOv8n weights (10 classes)
│   └── README.md
│
├── training/
│   ├── args.yaml                # Ultralytics training hyperparameters
│   ├── classes.json             # Class index → name mapping (nc: 10)
│   ├── data_subset.yaml         # Dataset YAML (paths, nc, names)
│   ├── confusion_matrix.png     # Class-level confusion matrix
│   ├── confusion_matrix_normalized.png
│   ├── results.csv              # Epoch-by-epoch training metrics
│   ├── results.png              # mAP, loss curves chart
│   └── README.md
│
├── docs/
│   └── SETTINGS.md              # Detection settings & threshold guidance
│
├── docker-compose.yml           # Full-stack orchestration
├── .env.example                 # Root environment template
├── .gitignore
└── README.md
```

---

## 5. The Detection Model

### Model: YOLOv8n (Nano)
- **Architecture**: YOLOv8n — the smallest/fastest variant of Ultralytics YOLOv8
- **Weights file**: `models/best.pt`
- **Number of classes**: 10

### Class Reference Table

| Index | Class Name | Category | Meaning |
|:---:|---|---|---|
| 0 | `Hardhat` | PPE Positive | Safety helmet detected on a person |
| 1 | `Mask` | PPE Positive | Protective face mask detected |
| 2 | `NO-Hardhat` | **Violation** | Person's head visible without a hardhat |
| 3 | `NO-Mask` | **Violation** | Person's face visible without a mask |
| 4 | `NO-Safety Vest` | **Violation** | Person's torso visible without a high-vis vest |
| 5 | `Person` | Entity | A human worker |
| 6 | `Safety Cone` | Environment | Traffic/hazard cone |
| 7 | `Safety Vest` | PPE Positive | High-visibility reflective vest detected |
| 8 | `machinery` | Environment | Heavy equipment (excavators, cranes, etc.) |
| 9 | `vehicle` | Environment | Work trucks, cars, etc. |

### Class Mappings (in `config.py`)
```python
PPE_POSITIVE     = {0: 'Hardhat',        1: 'Mask', 7: 'Safety Vest'}
PPE_NEGATIVE     = {2: 'NO-Hardhat', 3: 'NO-Mask', 4: 'NO-Safety Vest'}
VIOLATION_TO_REQUIRED = {2: 0, 3: 1, 4: 7}  # violation ID → required PPE ID
ENTITY_CLASSES   = {5: 'Person'}
ENVIRONMENT_CLASSES = {6: 'Safety Cone', 8: 'machinery', 9: 'vehicle'}
```

---

## 6. Backend — Deep Dive

### 6.1 Entry Point: `main.py`

The app uses FastAPI's **lifespan context manager** for startup/shutdown:

1. **Startup**: Initializes the SQLite database (`init_db()`), creates `uploads/` and `thumbnails/` directories, and loads the YOLO model into `app.state.model`.
2. **Shutdown**: Graceful (no-op currently).

**CORS** is configured via the `CORS_ORIGINS` env var (comma-separated), defaulting to `localhost:5173`, `localhost:3000`, and `localhost:8080`.

**Static file mounts**: `/thumbnails` and `/uploads` are served as static file directories.

**Router registration order**:
```python
app.include_router(detect.router)   # /api/detect/*
app.include_router(ws.ws_router)    # /ws/*
app.include_router(zones.router)    # /api/zones/*
app.include_router(violations.router) # /api/violations/*
app.include_router(dashboard.router)  # /api/*
app.include_router(settings.router)   # /api/settings/*
```

---

### 6.2 Core Detection Logic: `detection.py`

This is the computational heart of the system. All functions operate on raw numpy arrays.

#### `run_inference(image_array, model, conf_threshold, per_class_thresholds)`
- Runs YOLO on the image, filters detections by confidence.
- Supports **per-class confidence thresholds** — if a class has a specific override, it uses that; otherwise falls back to the global `conf_threshold`.
- Returns: `[{class_id, class_name, confidence, bbox: [x1,y1,x2,y2]}, ...]`

#### `calculate_iou(box1, box2)` & `calculate_containment(box1, box2)`
- IoU (Intersection over Union): standard overlap ratio.
- **Containment**: intersection area ÷ *smaller* box's area. This catches nested boxes (e.g. a tight torso box fully inside a full-body person box) where standard IoU stays low even though the overlap is nearly 100%.

#### `nms_persons(person_detections, iou_threshold=0.35, containment_threshold=0.7)`
- Secondary Non-Maximum Suppression just for `Person` class.
- YOLO's built-in NMS can let duplicate person boxes slip through for the same physical person. This catches them using **both** IoU and containment signals.
- Keeps only the highest-confidence box per physical person.

#### `associate_ppe_to_persons(detections, min_person_conf=0.45)`
- Groups all detections into `persons` and `ppe_items`.
- For each person, checks every PPE item: if `IoU > 0.3` **OR** the center of the PPE box falls inside the person box → the PPE belongs to that worker.
- Builds per-worker compliance card:
  ```python
  {
    "person_bbox": [...],
    "person_confidence": float,
    "wearing": ["Hardhat", "Safety Vest"],  # PPE_POSITIVE matches
    "missing": ["Mask"],                    # Required items not found
    "violations": ["NO-Mask"],              # PPE_NEGATIVE matches
    "compliant": bool
  }
  ```

#### `point_in_polygon(point, polygon)`
- **Ray-casting algorithm** for point-in-polygon test.
- Works with normalized coordinates (0–1), where `point` is `(cx, cy)` and `polygon` is a list of `{x, y}` dicts.

#### `apply_zone_scoped_compliance(persons, zones, frame_width, frame_height)`
This is a critical correctness fix. Without it, a worker could be flagged for "missing Mask" even if the zone they're in only requires a Hardhat.

- For each worker, uses their **bottom-center point** (foot position) to determine which zones they stand in.
- Workers inside a zone: compliance is re-evaluated **only** against that zone's `required_ppe` list.
- Workers outside any zone: original model-detected violations apply.

#### `check_zone_violations(persons, zones, frame_width, frame_height)`
- Generates `violation_events` — one entry per missing PPE item per zone per person.
- These feed the `log_violation()` database call with a proper `zone_id` and `zone_name`.

#### `calculate_compliance_rate(persons)` → `0.0–100.0`
- Returns `100.0` if no persons detected (no one to violate).

#### `generate_thumbnail(frame, bbox, output_dir, prefix='violation')`
- Crops `bbox` with **20% padding** on all sides.
- Saves a uniquely-named JPEG (`violation_{8char-uuid}.jpg`) to `THUMBNAIL_DIR`.

---

### 6.3 Database Layer: `database.py`

Uses **aiosqlite** (async SQLite) throughout. All functions are `async`.

#### Tables

| Table | Key Columns | Purpose |
|---|---|---|
| `zones` | id, name, camera_id, polygon_points (JSON), required_ppe (JSON), created_at | Safety zone definitions |
| `violations` | id, timestamp, class_name, confidence, zone_id, zone_name, bbox (JSON), thumbnail_path, frame_number, video_filename | Individual violation incidents |
| `settings` | key (PK), value | Key-value store for system config |
| `stats` | date (PK), total_persons, total_compliant | Daily aggregated compliance counters |
| `video_jobs` | job_id (PK), filename, filepath, camera_id, status, created_at, completed_at | Video upload job tracking |

#### Migration
On every startup, attempts `ALTER TABLE video_jobs ADD COLUMN camera_id` — silently fails if it already exists. This handles older databases.

#### Key Functions

| Function | Description |
|---|---|
| `init_db()` | Creates all tables, inserts default settings if absent |
| `create_zone / get_zones / update_zone / delete_zone` | Full CRUD for zones |
| `get_zones(camera_id=None)` | Optionally scoped to one camera ID |
| `log_violation(...)` | Inserts a new violation record |
| `get_violations(page, page_size, date_from, date_to, class_name, zone_id)` | Paginated, filtered query |
| `get_violations_for_export()` | All violations for CSV export |
| `get_violation_stats_today()` | Count of today's violations |
| `get_compliance_trend()` | Hourly violation counts for today |
| `get_most_violated_zone_today()` | Top zone by violation count today |
| `get_violations_by_class()` | Violation counts grouped by class for today |
| `update_stats(total_persons, compliant)` | Upserts daily stat row (cumulative) |
| `get_settings / update_settings` | Read/write the key-value settings table |
| `create_video_job / update_video_job_status / get_all_video_jobs` | Video job lifecycle |

---

### 6.4 API Routers

#### `detect.py` — `/api/detect/*`

| Endpoint | Method | Description |
|---|---|---|
| `/api/detect/image` | `POST` | Upload image, run inference, log violations, return detections + persons + compliance rate |
| `/api/detect/video` | `POST` | Upload video, create job record (DB + in-memory), return `{job_id}` |
| `/api/detect/jobs` | `GET` | List all video jobs (from DB, with `file_exists` flag) |
| `/api/detect/jobs/pending` | `GET` | Jobs still in `pending`/`processing` state; restores them into in-memory index |
| `/api/detect/jobs/{job_id}` | `DELETE` | Delete job record + uploaded file from disk |

**Image detection flow:**
1. Decode bytes → NumPy array with OpenCV
2. Load settings (threshold, per-class overrides)
3. `run_inference()` → `associate_ppe_to_persons()` → `apply_zone_scoped_compliance()`
4. `check_zone_violations()` for zone-specific events
5. For every violation: `generate_thumbnail()` → `log_violation()`
6. `update_stats()` with person/compliant counts

**Video detection flow:**
1. Save file to `uploads/` directory
2. `create_video_job()` in DB + in-memory `video_jobs` dict
3. Return `job_id` immediately (fire-and-forget; actual processing happens over WebSocket)

#### `ws.py` — `/ws/video-stream/{job_id}`

WebSocket handler for real-time video processing:

1. Accepts connection and looks up `job_id` in the in-memory `video_jobs` dict
2. Opens the video file with `cv2.VideoCapture`
3. Reads the `frame_sample_rate` setting (processes every Nth frame, default: every 5th)
4. For each sampled frame: runs the same inference+compliance pipeline as image detection
5. Sends JSON per frame:
   ```json
   {
     "type": "frame",
     "frame_number": 150,
     "timestamp_sec": 5.0,
     "detections": [...],
     "persons": [...],
     "compliance_rate": 85.0,
     "violations": [...],
     "progress": 42.5
   }
   ```
6. On completion sends:
   ```json
   {
     "type": "complete",
     "total_frames": 900,
     "processed_frames": 180,
     "overall_compliance_rate": 88.3,
     "total_violations": 12
   }
   ```
7. Handles `WebSocketDisconnect` gracefully; releases video capture in `finally`

#### `zones.py` — `/api/zones/*`

| Endpoint | Method | Description |
|---|---|---|
| `POST /api/zones` | Create | Saves a new zone with normalized polygon points and required PPE |
| `GET /api/zones` | List | Returns all zones; optionally filtered by `?camera_id=` |
| `GET /api/zones/cameras` | List | Returns distinct camera IDs for picker population |
| `PUT /api/zones/{id}` | Update | Updates an existing zone |
| `DELETE /api/zones/{id}` | Delete | Removes a zone |

**Pydantic Models:**
- `Point { x: float, y: float }` — normalized 0–1 coordinates
- `ZoneCreate / ZoneUpdate { name, camera_id, polygon_points: [Point], required_ppe: [str] }`

#### `violations.py` — `/api/violations/*`

| Endpoint | Method | Description |
|---|---|---|
| `GET /api/violations` | List | Paginated (page, page_size), filterable by date range, class name, zone ID |
| `DELETE /api/violations/{id}` | Delete | Removes record + best-effort deletes thumbnail file |
| `GET /api/violations/export` | Export | Streams CSV of all violations as a file download |

#### `dashboard.py` — `/api/compliance-summary`

Returns a single composite JSON:
```json
{
  "overall_compliance_rate": 87.4,
  "total_workers_detected": 340,
  "total_violations": 43,
  "most_violated_zone": "Loading Dock",
  "compliance_by_class": [{"class_name": "NO-Hardhat", "count": 28}, ...],
  "compliance_trend": [{"period": "09:00", "rate": 5}, ...],
  "recent_violations": [...]
}
```

#### `settings.py` — `/api/settings`

| Endpoint | Method | Description |
|---|---|---|
| `GET /api/settings` | Read | Returns all settings as key-value dict |
| `PUT /api/settings` | Update | Upserts any number of key-value pairs |

**Persisted Settings:**

| Key | Default | Description |
|---|---|---|
| `confidence_threshold` | `0.4` | Global detection confidence filter |
| `frame_sample_rate` | `5` | Process every Nth frame during video |
| `per_class_thresholds` | `{}` | Override confidence per class name |

---

## 7. Frontend — Deep Dive

### 7.1 Routing (`App.jsx`)

```
/            → Dashboard.jsx
/monitor     → LiveMonitor.jsx
/zones       → ZoneConfig.jsx
/violations  → ViolationsLog.jsx
/settings    → Settings.jsx
```
All routes are wrapped in `Layout.jsx` (sidebar + top bar shell).

### 7.2 API Client (`src/api/client.js`)

An **Axios instance** configured with `API_BASE` (from env or `http://localhost:8000`).

| Export | Type | Description |
|---|---|---|
| `detectImage(file, cameraId)` | Axios POST | Multipart form upload for image |
| `detectVideo(file, cameraId)` | Axios POST | Multipart form upload for video |
| `getZones(cameraId?)` | Axios GET | Fetch zones, optionally scoped |
| `getCameraIds()` | Axios GET | Get distinct camera IDs |
| `createZone(data)` | Axios POST | Create a new zone |
| `updateZone(id, data)` | Axios PUT | Update a zone |
| `deleteZone(id)` | Axios DELETE | Delete a zone |
| `getViolations(params)` | Axios GET | Paginated violation query |
| `deleteViolation(id)` | Axios DELETE | Delete a single violation |
| `exportViolations(params)` | Axios GET | CSV blob download |
| `getComplianceSummary()` | Axios GET | Dashboard composite data |
| `getSettings()` | Axios GET | Load settings |
| `updateSettings(data)` | Axios PUT | Save settings |
| `connectVideoStream(jobId, onMessage, onClose, onError)` | WebSocket | Opens WS, returns the socket |

**WebSocket URL** is derived from `WS_BASE` (env var or `API_BASE` with `http` → `ws` substitution).

### 7.3 Pages

#### `Dashboard.jsx`
- Polls `/api/compliance-summary` every **30 seconds**.
- Shows 4 stat cards: **Compliance Rate**, **Person Detections Today**, **Violations Today**, **Most Violated Zone**.
- Two Recharts charts: **Line chart** (violations by hour) and **Horizontal Bar chart** (violations by class).
- Recent violations feed with thumbnail images.
- Shows `EmptyState` when no data exists yet.

#### `LiveMonitor.jsx`
The most complex page. State machine with states: `idle → uploading → processing/image-result → complete`.

**Camera/Site ID picker**: selects which zones apply. Users can define a new camera ID inline.

**Image mode:**
1. User drops/selects an image file
2. `detectImage()` POST → backend returns detections immediately
3. Uses `useEffect` to draw bounding boxes on a `<canvas>` overlaid on the `<img>`
4. Uses `getContainLayout()` helper to account for CSS `object-contain` letterboxing so boxes align correctly

**Video mode:**
1. `detectVideo()` POST → backend saves file, returns `job_id`
2. `connectVideoStream(job_id)` opens WebSocket
3. `requestAnimationFrame` loop continuously draws `latestFrameRef.current` detections on a `<canvas>` overlaid on `<video>`
4. WebSocket messages update `latestFrameRef`, `progress`, `currentPersons`
5. Violation toasts shown throttled (only on frames divisible by 25)

**Workers side panel**: shows per-worker compliance status (COMPLIANT / VIOLATION badge), which zone they're in, and a checkmark/cross for each PPE item.

**Canvas drawing** (`drawDetectionsOnCanvas`):
- Iterates raw detections (not persons)
- Draws colored bounding boxes: yellow for PPE positive, red for violations, gray for Person/environment
- Labels: `"ClassName 87%"` with color-matched background

#### `ZoneConfig.jsx`
Interactive polygon drawing tool.

**Canvas interaction:**
- Click to place polygon vertices
- Live preview: dashed line from last point to cursor
- Click within 15px of first point to **close** the polygon
- Undo Point / Clear All buttons

**Reference image**: Upload a camera frame as background — canvas resizes to match its aspect ratio (max 800×600). Polygon coordinates are stored normalized (0–1 relative to canvas size).

**Zone form**: Zone name (required) + checkboxes for Hardhat / Mask / Safety Vest requirements. A live preview shows which PPE items will be saved.

**Camera scoping**: Each zone is tagged with a camera ID. Only zones with a matching camera ID are applied when processing footage from that same camera.

**Saved zones list**: Shows zones for the selected camera. Hover to reveal edit (✏) and delete (🗑) icons.

#### `ViolationsLog.jsx`
Paginated table with filter bar.

**Filters**: date range (from/to), violation class dropdown, zone dropdown.

**Table columns**: #, Thumbnail, Timestamp, Class (colored badge), Zone, Confidence %, Frame Number, Delete action.

**Pagination**: 10/25/50 per page selector, prev/next arrows.

**CSV Export**: calls `/api/violations/export` and triggers browser file download.

**Delete**: removes the record and its thumbnail from the backend; steps back a page if the last item on a non-first page was deleted.

#### `Settings.jsx`
Loads current settings on mount. Three controls:

1. **Global Confidence Threshold** — Range slider (0.1–0.9, step 0.05). Info callout explains trade-offs.
2. **Per-Class Thresholds** — Collapsible section. One slider per class name (0–0.9, step 0.05). Shows "Auto" when 0 (uses global). Highlighted in yellow when overridden.
3. **Frame Sampling Rate** — Range slider (1–30). Describes speed vs thoroughness trade-off.

Saves all via `PUT /api/settings`.

### 7.4 Components

| Component | Description |
|---|---|
| `Layout.jsx` | App shell with sidebar navigation links and `<Outlet>` for page content |
| `StatCard.jsx` | Reusable card with icon, title, value, and optional color class |
| `EmptyState.jsx` | Centered placeholder with title and description for no-data states |
| `Toast.jsx` | Toast notification system using React Context. `useToast()` hook exposes `addToast({title, message, type})`. Auto-dismisses after 4 seconds. |

### 7.5 Constants (`src/config/constants.js`)

```js
API_BASE = env.VITE_API_BASE || 'http://localhost:8000'
WS_BASE  = env.VITE_WS_BASE  || API_BASE.replace(/^http/, 'ws')

CLASS_NAMES   = ['Hardhat', 'Mask', 'NO-Hardhat', 'NO-Mask', 'NO-Safety Vest',
                 'Person', 'Safety Cone', 'Safety Vest', 'machinery', 'vehicle']

CLASS_COLORS  = { 'Hardhat': '#F59E0B', 'Mask': '#F59E0B', 'Safety Vest': '#F59E0B',
                  'NO-Hardhat': '#EF4444', 'NO-Mask': '#EF4444', 'NO-Safety Vest': '#EF4444',
                  'Person': '#6B7280', ... }

PPE_CLASSES       = ['Hardhat', 'Mask', 'Safety Vest']
VIOLATION_CLASSES = ['NO-Hardhat', 'NO-Mask', 'NO-Safety Vest']
```

---

## 8. Database Schema (SQLite)

```sql
CREATE TABLE zones (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT,
    camera_id     TEXT,
    polygon_points TEXT,   -- JSON array of {x: float, y: float} (normalized 0-1)
    required_ppe  TEXT,    -- JSON array of strings e.g. ["Hardhat", "Safety Vest"]
    created_at    TEXT
);

CREATE TABLE violations (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp      TEXT,   -- ISO 8601
    class_name     TEXT,   -- e.g. "NO-Hardhat"
    confidence     REAL,
    zone_id        INTEGER,
    zone_name      TEXT,
    bbox           TEXT,   -- JSON [x1, y1, x2, y2]
    thumbnail_path TEXT,   -- filename relative to THUMBNAIL_DIR
    frame_number   INTEGER,
    video_filename TEXT
);

CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT
);

CREATE TABLE stats (
    date           TEXT PRIMARY KEY,  -- YYYY-MM-DD
    total_persons  INTEGER,
    total_compliant INTEGER
);

CREATE TABLE video_jobs (
    job_id       TEXT PRIMARY KEY,
    filename     TEXT,
    filepath     TEXT,
    camera_id    TEXT DEFAULT 'default',
    status       TEXT DEFAULT 'pending',  -- pending | processing | complete | error
    created_at   TEXT,
    completed_at TEXT
);
```

---

## 9. Data Flow: End-to-End

### Image Detection

```
User uploads image
      ↓
POST /api/detect/image (multipart)
      ↓
cv2.imdecode → numpy array
      ↓
run_inference(frame, model, conf_threshold, per_class_thresholds)
    → YOLO forward pass → filter by threshold
      ↓
associate_ppe_to_persons(detections)
    → separate persons & PPE items
    → nms_persons() → deduplicate person boxes
    → IoU + center-inside test → link PPE to persons
      ↓
get_zones(camera_id) → fetch matching safety zones
      ↓
apply_zone_scoped_compliance(persons, zones, w, h)
    → ray-cast each worker's foot point into zones
    → filter violations to only zone-required PPE
      ↓
check_zone_violations(persons, zones, w, h)
    → generate zone-specific violation events
      ↓
for each violation:
    generate_thumbnail(frame, bbox) → save JPEG crop
    log_violation(...) → INSERT into violations table
      ↓
update_stats(total_persons, compliant_count)
      ↓
Return JSON: { detections, persons, compliance_rate, violations }
      ↓
Frontend draws bounding boxes on <canvas> overlay
Frontend shows worker compliance cards in sidebar
```

### Video Detection

```
User uploads video
      ↓
POST /api/detect/video → save file → create_video_job → return job_id
      ↓
Frontend opens WebSocket: /ws/video-stream/{job_id}
Frontend starts video playback + requestAnimationFrame canvas loop
      ↓
Backend: cv2.VideoCapture(filepath)
Backend: for each frame (sampled every N frames):
    → same inference pipeline as image
    → send JSON frame event over WebSocket
      ↓
Frontend: WebSocket onmessage → update latestFrameRef
requestAnimationFrame loop reads latestFrameRef → redraws boxes on canvas
      ↓
Backend: send "complete" event with summary stats
Frontend: setState('complete'), show summary bar
```

---

## 10. Zone System — How It Works

Zones define **physical areas** on a camera frame with specific PPE requirements.

### Drawing
1. User uploads a reference image in Zone Config (resizes canvas to match aspect ratio)
2. User clicks to place polygon vertices; clicks near start point to close
3. Normalized coordinates `(x/canvasW, y/canvasH)` are stored in the backend
4. Zones are scoped to a **Camera / Site ID**

### Enforcement
During detection:
1. Each worker's bottom-center pixel `(cx, bottom_y)` is normalized → `(cx/W, bottom_y/H)`
2. Ray-casting algorithm tests if that point is inside any zone polygon
3. If inside a zone: only that zone's `required_ppe` items matter for compliance
4. A worker missing a Mask in a "Hardhat-only zone" is **not** flagged for the Mask

### Why Bottom-Center?
Using the foot position (bottom of person bounding box) rather than the center of the whole body prevents false zone assignments when a worker leans into a zone from outside it.

---

## 11. Configuration & Environment Variables

### Backend (`.env` or Docker environment)

| Variable | Default | Description |
|---|---|---|
| `MODEL_PATH` | `../models/best.pt` | Path to YOLO `.pt` weights file |
| `DATABASE_PATH` | `backend/ppe_compliance.db` | SQLite database path |
| `UPLOAD_DIR` | `backend/uploads` | Video/image upload directory |
| `THUMBNAIL_DIR` | `backend/thumbnails` | Violation crop directory |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Allowed frontend origins (comma-separated) |

### Frontend (`.env` or Docker build args)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE` | `http://localhost:8000` | Backend HTTP URL |
| `VITE_WS_BASE` | derived from `VITE_API_BASE` | Backend WebSocket URL |

---

## 12. Running the Project

### Local Development

**Backend:**
```powershell
cd "PPE project\backend"
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
- API available at: `http://localhost:8000`
- Swagger docs at: `http://localhost:8000/docs`

**Frontend** (new terminal):
```powershell
cd "PPE project\frontend"
npm install
npm run dev
```
- UI available at: `http://localhost:5173`

### Docker Compose (Recommended)
```bash
docker compose up --build
```
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- Data persisted in Docker volume `backend_data`

> [!NOTE]
> The frontend Docker container uses **Nginx** serving the Vite production build. WebSocket and API proxying is configured in `frontend/nginx.conf`.

---

## 13. Complete REST API Reference

| Method | Path | Description | Key Params |
|---|---|---|---|
| GET | `/` | Health check | — |
| POST | `/api/detect/image` | Detect PPE in image | `file` (multipart), `camera_id` (form) |
| POST | `/api/detect/video` | Upload video for processing | `file` (multipart), `camera_id` (form) |
| GET | `/api/detect/jobs` | List all video jobs | — |
| GET | `/api/detect/jobs/pending` | List pending/processing jobs | — |
| DELETE | `/api/detect/jobs/{job_id}` | Delete job + file | — |
| WS | `/ws/video-stream/{job_id}` | WebSocket video stream | — |
| POST | `/api/zones` | Create safety zone | Body: `ZoneCreate` |
| GET | `/api/zones` | List zones | `?camera_id=` (optional) |
| GET | `/api/zones/cameras` | List distinct camera IDs | — |
| PUT | `/api/zones/{id}` | Update zone | Body: `ZoneUpdate` |
| DELETE | `/api/zones/{id}` | Delete zone | — |
| GET | `/api/violations` | List violations (paginated) | `page`, `page_size`, `date_from`, `date_to`, `class_name`, `zone_id` |
| DELETE | `/api/violations/{id}` | Delete violation + thumbnail | — |
| GET | `/api/violations/export` | Download violations CSV | — |
| GET | `/api/compliance-summary` | Dashboard aggregate data | — |
| GET | `/api/settings` | Get all settings | — |
| PUT | `/api/settings` | Update settings | Body: `{key: value}` dict |
| GET | `/thumbnails/{filename}` | Serve thumbnail image | — |
| GET | `/uploads/{filename}` | Serve uploaded file | — |

---

## 14. Key Design Decisions

### Why IoU + Center-Inside for PPE Association?
Plain IoU fails when a helmet box is small and a person box is large — the union is dominated by the person box, keeping IoU low even when the helmet is clearly on their head. Center-inside catches this case definitively.

### Why Secondary NMS for Persons?
YOLO's global NMS can let two slightly-different person boxes survive for the same worker. If both survive, the system counts the same worker twice, inflating violation counts. The custom `nms_persons()` uses both IoU and containment to suppress these duplicates.

### Why Zone-Scoped Compliance?
Without it, a worker in a "Hardhat-only" zone would be flagged as non-compliant for missing a Mask — even though masks aren't required there. The `apply_zone_scoped_compliance()` function ensures compliance is evaluated strictly against zone requirements.

### Why Normalized Zone Coordinates?
Zone polygon points are stored as `(0–1)` fractions of the frame dimensions. This makes them resolution-independent — the same zone works regardless of whether the video is 720p or 1080p.

### Why SQLite?
The project is designed as a standalone system that doesn't require an external database server. SQLite is embedded, zero-config, and more than sufficient for single-site deployment. The async `aiosqlite` wrapper ensures the FastAPI event loop isn't blocked.

---

## 15. Training Details

| Parameter | Value |
|---|---|
| Base model | YOLOv8n (nano) |
| Classes | 10 |
| Training config | `training/args.yaml` |
| Dataset config | `training/data_subset.yaml` |
| Best weights | `models/best.pt` |
| Evaluation | `training/confusion_matrix.png`, `training/results.png` |
| Metrics log | `training/results.csv` |

> [!TIP]
> The model has **weaker recall** on `NO-Hardhat` and `NO-Safety Vest`. The Settings page recommends lowering per-class thresholds for these violation classes to improve detection at the cost of slightly more false positives.

---

*Documentation generated: September 28, 2026*
