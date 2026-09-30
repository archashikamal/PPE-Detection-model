from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import StreamingResponse
import io
import csv
import os
from typing import Optional
from database import get_violations, get_violations_for_export, get_violation, delete_violation
from config import THUMBNAIL_DIR

router = APIRouter(prefix="/api/violations", tags=["violations"])

@router.get("")
async def list_violations(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    class_name: Optional[str] = None,
    zone_id: Optional[int] = None
):
    return await get_violations(page, page_size, date_from, date_to, class_name, zone_id)

@router.delete("/{violation_id}")
async def remove_violation(violation_id: int):
    violation = await get_violation(violation_id)
    if not violation:
        raise HTTPException(status_code=404, detail="Violation not found")

    deleted = await delete_violation(violation_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Violation not found")

    # Best-effort cleanup of the associated thumbnail file
    thumbnail_path = violation.get("thumbnail_path")
    if thumbnail_path:
        full_path = os.path.join(THUMBNAIL_DIR, thumbnail_path)
        if os.path.isfile(full_path):
            os.remove(full_path)

    return {"deleted": violation_id}

@router.get("/export")
async def export_violations():
    violations = await get_violations_for_export()
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    if violations:
        headers = violations[0].keys()
        writer.writerow(headers)
        for v in violations:
            writer.writerow([v[h] for h in headers])
            
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=violations_export.csv"}
    )
