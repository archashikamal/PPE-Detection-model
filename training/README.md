# Model Training Artifacts

This folder holds the outputs of the YOLOv8n training run that produced the model used by the app (`models/best.pt`). Nothing here is required to run PPE Watch — it's kept for reference, reproducibility, and evaluation.

## Contents

| File | Description |
|---|---|
| `last.pt` | Final-epoch checkpoint (the best-performing checkpoint, used by the app, lives in `../models/best.pt`) |
| `classes.json` | Class names in the exact order the model outputs them |
| `data_subset.yaml` | Dataset config used for this training run |
| `args.yaml` | Full training run configuration (hyperparameters, augmentation, etc.) |
| `results.csv` / `results.png` | Training/validation metrics per epoch |
| `confusion_matrix.png` / `confusion_matrix_normalized.png` | Standard YOLO evaluation plots |

## Class list (index → name)

```
0: Hardhat
1: Mask
2: NO-Hardhat
3: NO-Mask
4: NO-Safety Vest
5: Person
6: Safety Cone
7: Safety Vest
8: machinery
9: vehicle
```

## Running inference manually

```bash
pip install ultralytics
```

```python
from ultralytics import YOLO
model = YOLO("../models/best.pt")
results = model.predict("your_image_or_video.mp4", conf=0.4)
```

## Known limitation

This dataset has no `harness` class. Zone rules requiring a harness would need either a supplementary dataset or to stay scoped to hardhat + vest checks (the current app's behavior — harness requirements are disabled in the UI).
