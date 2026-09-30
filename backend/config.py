import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MODEL_PATH = os.getenv("MODEL_PATH", os.path.abspath(os.path.join(BASE_DIR, "..", "models", "best.pt")))
DATABASE_PATH = os.getenv("DATABASE_PATH", os.path.join(BASE_DIR, "ppe_compliance.db"))
UPLOAD_DIR = os.getenv("UPLOAD_DIR", os.path.join(BASE_DIR, "uploads"))
THUMBNAIL_DIR = os.getenv("THUMBNAIL_DIR", os.path.join(BASE_DIR, "thumbnails"))

CLASS_NAMES = [
    'Hardhat', 'Mask', 'NO-Hardhat', 'NO-Mask', 'NO-Safety Vest',
    'Person', 'Safety Cone', 'Safety Vest', 'machinery', 'vehicle'
]

PPE_POSITIVE = {0: 'Hardhat', 1: 'Mask', 7: 'Safety Vest'}
PPE_NEGATIVE = {2: 'NO-Hardhat', 3: 'NO-Mask', 4: 'NO-Safety Vest'}
VIOLATION_TO_REQUIRED = {2: 0, 3: 1, 4: 7}

ENTITY_CLASSES = {5: 'Person'}
ENVIRONMENT_CLASSES = {6: 'Safety Cone', 8: 'machinery', 9: 'vehicle'}

DEFAULT_CONFIDENCE_THRESHOLD = 0.4
DEFAULT_FRAME_SAMPLE_RATE = 5
PERSON_PPE_IOU_THRESHOLD = 0.3
