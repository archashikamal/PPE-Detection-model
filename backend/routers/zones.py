from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from database import create_zone, get_zones, get_zone, update_zone, delete_zone, get_camera_ids

router = APIRouter(prefix="/api/zones", tags=["zones"])

class Point(BaseModel):
    x: float
    y: float

class ZoneCreate(BaseModel):
    name: str
    camera_id: str
    polygon_points: List[Point]
    required_ppe: List[str]

class ZoneUpdate(BaseModel):
    name: str
    camera_id: str
    polygon_points: List[Point]
    required_ppe: List[str]

@router.post("")
async def add_zone(zone: ZoneCreate):
    points = [{"x": p.x, "y": p.y} for p in zone.polygon_points]
    zone_id = await create_zone(zone.name, zone.camera_id, points, zone.required_ppe)
    return {"id": zone_id, "message": "Zone created"}

@router.get("")
async def list_zones(camera_id: Optional[str] = None):
    return await get_zones(camera_id)

@router.get("/cameras")
async def list_cameras():
    """Distinct camera/site IDs across all zones, for populating a picker."""
    return await get_camera_ids()

@router.put("/{zone_id}")
async def edit_zone(zone_id: int, zone: ZoneUpdate):
    points = [{"x": p.x, "y": p.y} for p in zone.polygon_points]
    await update_zone(zone_id, zone.name, zone.camera_id, points, zone.required_ppe)
    return {"message": "Zone updated"}

@router.delete("/{zone_id}")
async def remove_zone(zone_id: int):
    await delete_zone(zone_id)
    return {"message": "Zone deleted"}
