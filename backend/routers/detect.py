from fastapi import APIRouter, UploadFile, File, Form, Request, HTTPException
import cv2
import numpy as np
import uuid
import os
import asyncio
import datetime
from database import (
    get_zones, log_violation, get_settings, update_stats,
    create_video_job, update_video_job_status,
    get_all_video_jobs, get_pending_video_jobs, delete_video_job,
)
from detection import (
    run_inference, associate_ppe_to_persons, apply_zone_scoped_compliance,
    check_zone_violations, calculate_compliance_rate, generate_thumbnail
)
from config import UPLOAD_DIR, THUMBNAIL_DIR

router = APIRouter(prefix="/api/detect", tags=["detection"])

# In-memory job index — populated from DB on startup (see main.py lifespan)
video_jobs: dict = {}


# ── Image detection ─────────────────────────────────────────────────────────

@router.post("/image")
async def detect_image(request: Request, file: UploadFile = File(...), camera_id: str = Form("default")):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    h, w = frame.shape[:2]

    model = request.app.state.model
    settings = await get_settings()
    conf_threshold = settings.get("confidence_threshold", 0.4)
    per_class_thresholds = settings.get("per_class_thresholds", {})

    detections = run_inference(frame, model, conf_threshold, per_class_thresholds)
    persons = associate_ppe_to_persons(detections)

    # Only zones drawn for this camera/site apply — otherwise a zone drawn
    # for an unrelated scene could coincidentally overlap this frame too.
    zones = await get_zones(camera_id)
    persons = apply_zone_scoped_compliance(persons, zones, w, h)
    compliance_rate = calculate_compliance_rate(persons)

    zone_violations = check_zone_violations(persons, zones, w, h)

    all_violations = []
    for person in persons:
        if not person["compliant"]:
            for v in person["violations"]:
                all_violations.append({
                    "person_bbox": person["person_bbox"],
                    "class_name": v,
                    "zone_id": None,
                    "zone_name": "No Zone"
                })
    for zv in zone_violations:
        all_violations.append({
            "person_bbox": zv["person_bbox"],
            "class_name": zv["class_name"],
            "zone_id": zv["zone_id"],
            "zone_name": zv["zone_name"]
        })

    logged_violations = []
    timestamp = datetime.datetime.now().isoformat()
    for v in all_violations:
        thumbnail_name = generate_thumbnail(frame, v["person_bbox"], THUMBNAIL_DIR)
        await log_violation(
            timestamp=timestamp,
            class_name=v["class_name"],
            confidence=1.0,
            zone_id=v["zone_id"],
            zone_name=v["zone_name"],
            bbox=v["person_bbox"],
            thumbnail_path=thumbnail_name,
            frame_number=0,
            video_filename=""
        )
        logged_violations.append({**v, "thumbnail_path": thumbnail_name})

    compliant_persons = sum(1 for p in persons if p["compliant"])
    await update_stats(len(persons), compliant_persons)

    return {
        "detections": detections,
        "persons": persons,
        "compliance_rate": compliance_rate,
        "violations": logged_violations
    }


# ── Video upload ─────────────────────────────────────────────────────────────

@router.post("/video")
async def detect_video(file: UploadFile = File(...), camera_id: str = Form("default")):
    job_id = str(uuid.uuid4())

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filepath = os.path.join(UPLOAD_DIR, f"{job_id}_{file.filename}")

    with open(filepath, "wb") as f:
        f.write(await file.read())

    # Persist to DB so the job survives a server restart
    await create_video_job(job_id, file.filename, filepath, camera_id)

    # Also keep in the in-memory index for the WebSocket handler
    video_jobs[job_id] = {
        "status": "pending",
        "filepath": filepath,
        "filename": file.filename,
        "camera_id": camera_id,
    }

    return {"job_id": job_id}


# ── Job management ───────────────────────────────────────────────────────────

@router.get("/jobs")
async def list_jobs():
    """Return all video jobs (from DB — survives restarts)."""
    jobs = await get_all_video_jobs()
    # Attach live filepath-exists flag so frontend can check file is still there
    for job in jobs:
        job["file_exists"] = os.path.isfile(job.get("filepath", ""))
    return jobs


@router.get("/jobs/pending")
async def list_pending_jobs():
    """Return only jobs that were uploaded but never successfully processed."""
    jobs = await get_pending_video_jobs()
    result = []
    for job in jobs:
        exists = os.path.isfile(job.get("filepath", ""))
        if exists:
            # Restore into in-memory index so WebSocket can pick it up
            video_jobs[job["job_id"]] = {
                "status": job["status"],
                "filepath": job["filepath"],
                "filename": job["filename"],
                "camera_id": job.get("camera_id", "default"),
            }
            job["file_exists"] = True
            result.append(job)
        else:
            # File is gone — mark as error so it stops showing up
            await update_video_job_status(job["job_id"], "error")
    return result


@router.delete("/jobs/{job_id}")
async def remove_job(job_id: str):
    """Delete a job record and its uploaded video file."""
    jobs = await get_all_video_jobs()
    target = next((j for j in jobs if j["job_id"] == job_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Job not found")

    # Delete file from disk
    filepath = target.get("filepath", "")
    if filepath and os.path.isfile(filepath):
        os.remove(filepath)

    # Remove from DB and in-memory index
    await delete_video_job(job_id)
    video_jobs.pop(job_id, None)

    return {"deleted": job_id}
