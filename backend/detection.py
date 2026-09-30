import cv2
import numpy as np
import os
import uuid
from config import (
    CLASS_NAMES, PPE_POSITIVE, PPE_NEGATIVE, VIOLATION_TO_REQUIRED,
    ENTITY_CLASSES, ENVIRONMENT_CLASSES
)

# Maps a violation class name (e.g. "NO-Hardhat") to the PPE item name it's
# missing (e.g. "Hardhat"), the same names used in zones' required_ppe lists.
NEGATIVE_NAME_TO_REQUIRED_NAME = {
    PPE_NEGATIVE[neg_id]: PPE_POSITIVE[req_id]
    for neg_id, req_id in VIOLATION_TO_REQUIRED.items()
}

def run_inference(image_array, model, conf_threshold=0.4, per_class_thresholds=None):
    """Run YOLO inference on a numpy image array. Returns list of dicts:
    [{class_id, class_name, confidence, bbox: [x1,y1,x2,y2]}]
    Filter by per-class thresholds if provided, otherwise use global threshold."""
    if per_class_thresholds is None:
        per_class_thresholds = {}
        
    results = model(image_array, verbose=False)
    detections = []
    
    if len(results) > 0:
        boxes = results[0].boxes
        for box in boxes:
            conf = float(box.conf[0])
            cls_id = int(box.cls[0])
            class_name = CLASS_NAMES[cls_id]
            
            # Apply threshold
            threshold = per_class_thresholds.get(class_name, conf_threshold)
            if conf >= threshold:
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                detections.append({
                    "class_id": cls_id,
                    "class_name": class_name,
                    "confidence": conf,
                    "bbox": [x1, y1, x2, y2]
                })
                
    return detections

def calculate_iou(box1, box2):
    """Calculate IoU between two boxes [x1,y1,x2,y2]."""
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])

    inter_area = max(0, x2 - x1) * max(0, y2 - y1)
    
    box1_area = (box1[2] - box1[0]) * (box1[3] - box1[1])
    box2_area = (box2[2] - box2[0]) * (box2[3] - box2[1])
    
    union_area = box1_area + box2_area - inter_area
    
    if union_area == 0:
        return 0.0
    return inter_area / union_area

def is_center_inside(inner_box, outer_box):
    """Check if center of inner_box falls inside outer_box."""
    cx = (inner_box[0] + inner_box[2]) / 2
    cy = (inner_box[1] + inner_box[3]) / 2

    return (outer_box[0] <= cx <= outer_box[2]) and (outer_box[1] <= cy <= outer_box[3])

def calculate_containment(box1, box2):
    """Intersection area over the SMALLER box's area.
    Plain IoU understates overlap when one box is nested inside a much larger
    one (e.g. a tight torso box inside a full-body box for the same person) —
    the union is dominated by the large box, so IoU stays low even though the
    small box is basically entirely covered. Containment catches that case:
    it approaches 1.0 whenever the smaller box sits almost entirely inside the
    bigger one, regardless of how different their sizes are.
    """
    x1 = max(box1[0], box2[0])
    y1 = max(box1[1], box2[1])
    x2 = min(box1[2], box2[2])
    y2 = min(box1[3], box2[3])

    inter_area = max(0, x2 - x1) * max(0, y2 - y1)

    box1_area = (box1[2] - box1[0]) * (box1[3] - box1[1])
    box2_area = (box2[2] - box2[0]) * (box2[3] - box2[1])
    smaller_area = min(box1_area, box2_area)

    if smaller_area == 0:
        return 0.0
    return inter_area / smaller_area

def nms_persons(person_detections, iou_threshold=0.35, containment_threshold=0.7):
    """Secondary NMS specifically for Person boxes.
    YOLO applies NMS globally, but duplicate Person boxes for the same physical
    person can slip through — either shifted just enough to dodge YOLO's own
    IoU-based NMS, or nested (one tight box inside a wider one) where plain IoU
    stays low no matter the threshold. We suppress on EITHER signal and keep
    only the highest-confidence box per physical person.
    """
    if len(person_detections) <= 1:
        return person_detections

    # Sort by confidence descending — keep best first
    sorted_persons = sorted(person_detections, key=lambda p: p["confidence"], reverse=True)

    kept = []
    for candidate in sorted_persons:
        overlap_with_kept = False
        for k in kept:
            iou = calculate_iou(candidate["bbox"], k["bbox"])
            containment = calculate_containment(candidate["bbox"], k["bbox"])
            if iou > iou_threshold or containment > containment_threshold:
                overlap_with_kept = True
                break
        if not overlap_with_kept:
            kept.append(candidate)

    return kept


def associate_ppe_to_persons(detections, min_person_conf=0.45):
    """For each Person detection, find overlapping PPE items.
    Association criteria: IoU > 0.3 OR center of PPE box inside Person box.
    min_person_conf: discard Person detections below this confidence (reduces
    ghost workers from low-confidence duplicate detections).
    """
    persons = []
    ppe_items = []

    for d in detections:
        if d["class_id"] in ENTITY_CLASSES:
            # Skip very low-confidence person detections
            if d["confidence"] >= min_person_conf:
                persons.append(d)
        elif d["class_id"] in PPE_POSITIVE or d["class_id"] in PPE_NEGATIVE:
            ppe_items.append(d)

    # Deduplicate overlapping person boxes before building worker list
    persons = nms_persons(persons)

    results = []
    for person in persons:
        wearing = []
        missing = []
        violations = []

        person_box = person["bbox"]

        for ppe in ppe_items:
            ppe_box = ppe["bbox"]
            iou = calculate_iou(ppe_box, person_box)

            if iou > 0.3 or is_center_inside(ppe_box, person_box):
                cls_id = ppe["class_id"]
                if cls_id in PPE_POSITIVE:
                    wearing.append(PPE_POSITIVE[cls_id])
                elif cls_id in PPE_NEGATIVE:
                    violations.append(PPE_NEGATIVE[cls_id])
                    req_id = VIOLATION_TO_REQUIRED.get(cls_id)
                    if req_id is not None:
                        missing.append(PPE_POSITIVE[req_id])

        compliant = len(violations) == 0

        results.append({
            "person_bbox": person_box,
            "person_confidence": person["confidence"],
            "wearing": list(set(wearing)),
            "missing": list(set(missing)),
            "violations": list(set(violations)),
            "compliant": compliant
        })

    return results

def point_in_polygon(point, polygon):
    """Ray-casting algorithm for point-in-polygon test.
    point: (x, y) normalized 0-1
    polygon: list of (x, y) normalized 0-1
    """
    x, y = point
    inside = False
    j = len(polygon) - 1
    for i in range(len(polygon)):
        xi, yi = polygon[i]['x'], polygon[i]['y']
        xj, yj = polygon[j]['x'], polygon[j]['y']
        
        intersect = ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi)
        if intersect:
            inside = not inside
        j = i
    return inside

def apply_zone_scoped_compliance(persons, zones, frame_width, frame_height):
    """Restrict each worker's compliant/violations/missing to only the PPE
    actually required by whatever zone(s) they're standing in.

    Without this, a worker's compliance badge is driven purely by whichever
    NO-Hardhat/NO-Mask/NO-Safety Vest boxes the model happened to detect on
    them — regardless of what any zone requires. That means a worker in a
    zone that only requires a Safety Vest could still get flagged VIOLATION
    for a missing Mask, which the zone never asked for.

    Workers not standing inside any zone keep the original "any detected
    violation counts" behavior, since there's no explicit requirement to
    judge them against otherwise.
    """
    for person in persons:
        person["zone_names"] = []

    if not zones:
        return persons

    for person in persons:
        box = person["person_bbox"]
        cx = (box[0] + box[2]) / 2 / frame_width
        cy = box[3] / frame_height
        person_pt = (cx, cy)

        containing_zones = [z for z in zones if point_in_polygon(person_pt, z["polygon_points"])]
        if not containing_zones:
            continue  # no zone applies here — keep original global compliance

        person["zone_names"] = [z["name"] for z in containing_zones]

        required = set()
        for z in containing_zones:
            required.update(z.get("required_ppe", []))

        person["violations"] = [
            v for v in person["violations"]
            if NEGATIVE_NAME_TO_REQUIRED_NAME.get(v) in required
        ]
        person["missing"] = [m for m in person["missing"] if m in required]
        person["compliant"] = len(person["violations"]) == 0

    return persons

def check_zone_violations(persons, zones, frame_width, frame_height):
    """For each person, check if they're inside any zone.
    If inside a zone, check if required PPE for that zone is present."""
    violation_events = []
    
    for person in persons:
        # Get bottom-center of person box as position
        box = person["person_bbox"]
        cx = (box[0] + box[2]) / 2 / frame_width
        cy = box[3] / frame_height
        
        person_pt = (cx, cy)
        
        for zone in zones:
            if point_in_polygon(person_pt, zone["polygon_points"]):
                required = zone.get("required_ppe", [])
                wearing = person["wearing"]
                
                missing_for_zone = []
                for req in required:
                    if req not in wearing:
                        missing_for_zone.append(req)
                        
                if missing_for_zone:
                    for m in missing_for_zone:
                        violation_events.append({
                            "person_bbox": box,
                            "zone_id": zone["id"],
                            "zone_name": zone["name"],
                            "missing_ppe": m,
                            "class_name": f"NO-{m}"
                        })
                        
    return violation_events

def calculate_compliance_rate(persons):
    """Returns compliance rate as percentage (0-100)."""
    if not persons:
        return 100.0
    
    compliant_count = sum(1 for p in persons if p["compliant"])
    return (compliant_count / len(persons)) * 100.0

def generate_thumbnail(frame, bbox, output_dir, prefix='violation'):
    """Crop the region around bbox from frame, save as JPEG thumbnail."""
    h, w = frame.shape[:2]
    
    x1, y1, x2, y2 = map(int, bbox)
    
    # Add 20% padding
    w_pad = int((x2 - x1) * 0.2)
    h_pad = int((y2 - y1) * 0.2)
    
    px1 = max(0, x1 - w_pad)
    py1 = max(0, y1 - h_pad)
    px2 = min(w, x2 + w_pad)
    py2 = min(h, y2 + h_pad)
    
    crop = frame[py1:py2, px1:px2]
    
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    filename = f"{prefix}_{uuid.uuid4().hex[:8]}.jpg"
    filepath = os.path.join(output_dir, filename)
    
    cv2.imwrite(filepath, crop)
    return filename
