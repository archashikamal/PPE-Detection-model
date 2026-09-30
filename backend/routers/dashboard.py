from fastapi import APIRouter
from database import (
    get_violation_stats_today, get_compliance_trend,
    get_violations_by_class, get_violations, get_stats_today,
    get_most_violated_zone_today
)

router = APIRouter(prefix="/api", tags=["dashboard"])

@router.get("/compliance-summary")
async def compliance_summary():
    stats = await get_stats_today()
    total_persons = stats["total_persons"]
    total_compliant = stats["total_compliant"]
    
    overall_compliance_rate = 100.0
    if total_persons > 0:
        overall_compliance_rate = (total_compliant / total_persons) * 100.0
        
    total_violations = await get_violation_stats_today()
    compliance_by_class = await get_violations_by_class()
    compliance_trend = await get_compliance_trend()
    
    recent_violations_res = await get_violations(page=1, page_size=20)
    recent_violations = recent_violations_res["items"]

    # Computed over the full day's violations, not just the recent sample above.
    most_violated_zone = await get_most_violated_zone_today()


    return {
        "overall_compliance_rate": overall_compliance_rate,
        "total_workers_detected": total_persons,
        "total_violations": total_violations,
        "most_violated_zone": most_violated_zone,
        "compliance_by_class": compliance_by_class,
        "compliance_trend": compliance_trend,
        "recent_violations": recent_violations
    }
