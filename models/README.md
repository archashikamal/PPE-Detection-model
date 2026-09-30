# Model

`best.pt` is the YOLOv8n checkpoint the backend loads at startup (see `backend/config.py` → `MODEL_PATH`). It's the best-validation-mAP checkpoint from the training run documented in `../training/`.

The backend resolves this path relative to its own location, so keep this folder at the project root, one level above `backend/`:

```
PPE project/
├── models/
│   └── best.pt
├── backend/
└── frontend/
```

For details on how this model was trained, its class list, and evaluation plots, see [`../training/README.md`](../training/README.md).
