# Frontend — PPE Watch UI

React (Vite) single-page application for the PPE compliance dashboard, live detection monitor, polygon hazard zone configuration, violations log, and system settings.

## Stack

- **React 18** + **React Router**
- **Vite** for lightning-fast build and bundling
- **TailwindCSS** for UI design
- **Recharts** for real-time compliance charts and analytics
- **Axios** for REST API calls & native **WebSocket** for synchronized video frame streaming
- **Lucide React** for icons

---

## Local Setup

```bash
cd frontend
npm install
npm run dev
```

App runs locally at `http://localhost:5173`.  
By default, it connects to the backend at `http://localhost:8000`.

---

## Environment Variables

Copy `.env.example` to `.env.local` to override connection endpoints:

| Variable | Default | Description |
|:---|:---|:---|
| `VITE_API_BASE` | `http://localhost:8000` | HTTP base URL of the FastAPI backend |
| `VITE_WS_BASE` | `ws://localhost:8000` | WebSocket base URL for video streaming |

---

## Production Build & Static Deployment

To create an optimized production bundle:

```bash
npm run build
```

This generates a static `dist/` directory ready to be served on **Vercel**, **Netlify**, **Cloudflare Pages**, or an Nginx web server.

### Deploying to Vercel / Netlify
1. Connect your repository and select root directory `frontend`.
2. Build command: `npm run build`
3. Output directory: `dist`
4. Configure environment variables in the project settings:
   - `VITE_API_BASE=https://your-backend-domain.com`
   - `VITE_WS_BASE=wss://your-backend-domain.com`

---

## Docker

Build and run the frontend using the multi-stage Nginx container:

```bash
# From project root
docker build -f frontend/Dockerfile -t ppe-frontend .
docker run -p 5173:80 ppe-frontend
```

---

## Directory Layout

```
frontend/src/
├── App.jsx            # Application routing definitions
├── main.jsx           # React DOM bootstrap
├── api/
│   └── client.js      # Axios client & WebSocket helper
├── config/
│   └── constants.js   # Dynamic API_BASE/WS_BASE & class palettes
├── components/
│   ├── Layout.jsx     # Navigation shell
│   ├── StatCard.jsx   # Metrics card
│   ├── EmptyState.jsx # Empty state placeholder
│   └── Toast.jsx      # Toast notification system
└── pages/
    ├── Dashboard.jsx     # Compliance rates, trend charts, recent alerts
    ├── LiveMonitor.jsx   # Video/image upload and real-time bounding box canvas
    ├── ZoneConfig.jsx    # Interactive polygon zone drawing
    ├── ViolationsLog.jsx # Incident log table and CSV export
    └── Settings.jsx      # Confidence threshold & sampling configuration
```
