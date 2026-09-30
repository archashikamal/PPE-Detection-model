# Settings Page — Concepts & Logic

The Settings page (`frontend/src/pages/Settings.jsx`) exposes three controls that tune how detection runs. This doc explains what each one actually does under the hood and why you'd adjust it, so the numbers aren't just abstract sliders.

## 1. Global Confidence Threshold

**What it is:** every box YOLO draws comes with a confidence score (0–1) — "how sure the model is this is really a Hardhat/Person/etc." This slider sets the minimum score a detection needs to survive at all. In `backend/detection.py`'s `run_inference()`, anything below the threshold is silently dropped before it ever reaches the rest of the pipeline (person association, zone checks, violation logging).

```python
# backend/detection.py
threshold = per_class_thresholds.get(class_name, conf_threshold)
if conf >= threshold:
    detections.append(...)
```

**The tradeoff it controls:**

| Direction | Effect |
|---|---|
| **Lower** (e.g. 0.2) | More detections survive, including ones the model is less sure about. Catches more *real* violations, but also more **false positives** — a hardhat flagged missing when it's actually there, just poorly lit or at an odd angle. |
| **Higher** (e.g. 0.7) | Only very confident detections count. Fewer false alarms, but real violations the model wasn't fully sure about can be **missed entirely**. |

Default is `0.4` — a middle ground. The app's own trained model has weaker recall specifically on `NO-Hardhat` and `NO-Safety Vest` (it under-detects these classes more than others), which is why the UI suggests lowering the threshold *just for those classes* rather than dropping the global number for everything — see the next section.

## 2. Per-Class Thresholds

**What it is:** an override table — instead of one global number applied to all 10 classes, any individual class (e.g. just `NO-Hardhat`) can get its own threshold. A value of `0` means "use the global threshold"; anything else overrides it for that class only.

```python
# backend/detection.py — falls back to the global threshold if no per-class override exists
threshold = per_class_thresholds.get(class_name, conf_threshold)
```

```js
// frontend/src/pages/Settings.jsx — only non-zero overrides are actually saved
const filteredClassThresholds = {};
for (const [cls, val] of Object.entries(settings.classThresholds)) {
  if (val > 0) filteredClassThresholds[cls] = val;
}
```

**Why it exists:** a model is rarely equally reliable across all classes. Some classes (e.g. `Safety Cone`) might stay accurate even at a high threshold, while others (`NO-Hardhat`, per this model's known weak recall) need a lower bar to catch real cases. This lets you tune each class independently instead of accepting one blunt global number that's a compromise for everything.

## 3. Frame Sampling Rate

**What it is:** for *video* processing only (not single images) — instead of running the relatively expensive YOLO model on every single frame, the backend only runs detection on every Nth frame:

```python
# backend/routers/ws.py
if frame_number % sample_rate == 0:
    detections = run_inference(frame, ...)
```

"Every 5th frame" (the default) means frames 0, 5, 10, 15… get analyzed for PPE compliance; the rest are still played back in the UI, just not run through the model.

**The tradeoff it controls:**

| Direction | Effect |
|---|---|
| **Lower** (e.g. every 1st–2nd frame) | More thorough — catches brief violations, like someone removing a hardhat for 2 seconds. Much slower to process since inference runs far more often. |
| **Higher** (e.g. every 15th–30th frame) | Much faster processing. Short-duration events that happen between sampled frames can be missed entirely. |

This is purely a speed/thoroughness dial — it doesn't affect detection *accuracy* on the frames that are sampled, only how many frames get looked at in the first place.

## How they interact in practice

- **Confidence thresholds** control *which detections you trust*.
- **Sampling rate** controls *how often you even look*.

A common effective combination for a busy site: a moderate global threshold (`0.4`), a lowered per-class threshold specifically for the violation classes the model is weak on (`NO-Hardhat`, `NO-Safety Vest`), and a lower sampling rate (denser sampling) when catching brief violations matters more than raw processing speed.
