from fastapi import APIRouter, Body
from typing import Dict, Any
from database import get_settings, update_settings

router = APIRouter(prefix="/api/settings", tags=["settings"])

@router.get("")
async def read_settings():
    return await get_settings()

@router.put("")
async def write_settings(settings: Dict[str, Any] = Body(...)):
    await update_settings(settings)
    return {"message": "Settings updated"}
