from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Request
import cv2
import asyncio
import datetime
import os
import json
from routers.detect import video_jobs
from database import get_zones, log_violation, get_settings, update_stats
from detection import (
    run_inference, associate_ppe_to_persons, apply_zone_scoped_compliance,
    check_zone_violations, calculate_compliance_rate, generate_thumbnail
)
from config import THUMBNAIL_DIR

ws_router = APIRouter()

@ws_router.websocket("/ws/video-stream/{job_id}")
async def video_stream(websocket: WebSocket, job_id: str):
    await websocket.accept()
    
    if job_id not in video_jobs:
        await websocket.close(code=1000)
        return
        
    job = video_jobs[job_id]
    filepath = job["filepath"]
    filename = job["filename"]
    camera_id = job.get("camera_id", "default")
    
    cap = cv2.VideoCapture(filepath)
    if not cap.isOpened():
        await websocket.close(code=1000)
        return
        
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    
    model = websocket.app.state.model
    settings = await get_settings()
    sample_rate = int(settings.get("frame_sample_rate", 5))
    conf_threshold = settings.get("confidence_threshold", 0.4)
    per_class_thresholds = settings.get("per_class_thresholds", {})
    
    frame_number = 0
    processed_frames = 0
    total_violations_count = 0
    total_compliance_sum = 0
    
    # Only zones drawn for this camera/site apply — otherwise a zone drawn
    # for an unrelated scene could coincidentally overlap this video too.
    zones = await get_zones(camera_id)
    
    try:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
                
            if frame_number % sample_rate == 0:
                h, w = frame.shape[:2]
                
                detections = run_inference(frame, model, conf_threshold, per_class_thresholds)
                persons = associate_ppe_to_persons(detections)
                persons = apply_zone_scoped_compliance(persons, zones, w, h)

                compliance_rate = calculate_compliance_rate(persons)
                total_compliance_sum += compliance_rate

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
                timestamp_sec = frame_number / fps if fps > 0 else 0
                
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
                        frame_number=frame_number,
                        video_filename=filename
                    )
                    
                    logged_violations.append({
                        **v,
                        "thumbnail_path": thumbnail_name
                    })
                    
                total_violations_count += len(logged_violations)
                
                compliant_persons = sum(1 for p in persons if p["compliant"])
                await update_stats(len(persons), compliant_persons)
                
                await websocket.send_json({
                    "type": "frame",
                    "frame_number": frame_number,
                    "timestamp_sec": timestamp_sec,
                    "detections": detections,
                    "persons": persons,
                    "compliance_rate": compliance_rate,
                    "violations": logged_violations,
                    "progress": (frame_number / total_frames) * 100 if total_frames > 0 else 0
                })
                
                processed_frames += 1
                
                # Small sleep to allow other tasks to run and avoid overwhelming network
                await asyncio.sleep(0.01)
                
            frame_number += 1
            
        overall_compliance = total_compliance_sum / processed_frames if processed_frames > 0 else 100.0
        await websocket.send_json({
            "type": "complete",
            "total_frames": total_frames,
            "processed_frames": processed_frames,
            "overall_compliance_rate": overall_compliance,
            "total_violations": total_violations_count
        })
            
    except WebSocketDisconnect:
        print(f"WebSocket disconnected for job {job_id}")
    finally:
        cap.release()
