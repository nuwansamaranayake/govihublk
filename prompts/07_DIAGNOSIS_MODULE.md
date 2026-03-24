# Prompt 07 — Crop Disease Diagnosis Module

## Context
Matching engine is operational. Now build the AI-powered crop disease identification pipeline.

## Objective
Implement image upload, CNN inference (with placeholder model for Phase 1), confidence routing, and OpenRouter-powered Sinhala treatment advice generation.

## Architecture Reference
Two-stage pipeline: Image → CNN classification → Confidence routing → OpenRouter Sinhala advice → Store & return.

## Instructions

### 1. app/diagnosis/schemas.py

- `DiagnosisUploadRequest`: crop_id (UUID, optional — user may not know), image (UploadFile)
- `DiagnosisResponse`: id, classification, confidence, top_3_predictions (list of {label, confidence}), advice_text, advice_language, crop_name, image_url, created_at
- `DiagnosisHistoryFilter`: crop_id (opt), classification (opt), page, size
- `DiagnosisFeedbackRequest`: feedback (enum: helpful/not_helpful/incorrect)
- `DiagnosisBrief`: id, classification, confidence, crop_name, image_url, created_at

### 2. app/diagnosis/cnn.py — CNN Inference Wrapper

```python
class CropDiseaseCNN:
    """
    Wraps EfficientNet-Lite0 or MobileNetV2 for crop disease classification.
    
    Phase 1: Uses a placeholder that returns mock predictions.
             The real model will be loaded from /app/ml/models/crop_disease.pt
    Phase 2: Fine-tuned on Sri Lanka field images.
    """
    
    MODEL_PATH = "/app/ml/models/crop_disease.pt"
    IMAGE_SIZE = (224, 224)
    
    # PlantVillage 38 classes mapping
    CLASS_NAMES = [
        "Apple___Apple_scab", "Apple___Black_rot", "Apple___Cedar_apple_rust",
        "Apple___healthy", "Blueberry___healthy", "Cherry___Powdery_mildew",
        "Cherry___healthy", "Corn___Cercospora_leaf_spot",
        "Corn___Common_rust", "Corn___Northern_Leaf_Blight", "Corn___healthy",
        "Grape___Black_rot", "Grape___Esca", "Grape___Leaf_blight",
        "Grape___healthy", "Orange___Haunglongbing",
        "Peach___Bacterial_spot", "Peach___healthy",
        "Pepper___Bacterial_spot", "Pepper___healthy",
        "Potato___Early_blight", "Potato___Late_blight", "Potato___healthy",
        "Raspberry___healthy", "Rice___Brown_spot", "Rice___Hispa",
        "Rice___Leaf_Blast", "Rice___healthy",
        "Soybean___healthy", "Squash___Powdery_mildew",
        "Strawberry___Leaf_scorch", "Strawberry___healthy",
        "Tomato___Bacterial_spot", "Tomato___Early_blight",
        "Tomato___Late_blight", "Tomato___Leaf_Mold",
        "Tomato___Septoria_leaf_spot", "Tomato___healthy"
    ]
    
    def __init__(self):
        self.model = None
        self.device = "cpu"
    
    async def load_model(self):
        """Load model at startup. If model file missing, use placeholder."""
        # Try loading real model
        # If not found, log warning and set self.model = None (placeholder mode)
    
    async def predict(self, image_bytes: bytes) -> list[dict]:
        """
        Returns top-3 predictions: [{label: str, confidence: float}, ...]
        If model not loaded, returns placeholder prediction with confidence=0.5
        """
        if self.model is None:
            # PLACEHOLDER MODE for initial deployment
            return [
                {"label": "Tomato___Late_blight", "confidence": 0.55},
                {"label": "Tomato___Early_blight", "confidence": 0.25},
                {"label": "Tomato___Bacterial_spot", "confidence": 0.10},
            ]
        
        # Real inference:
        # 1. PIL Image from bytes
        # 2. Resize to 224x224
        # 3. Normalize (ImageNet mean/std)
        # 4. Forward pass
        # 5. Softmax
        # 6. Top-3
    
    def preprocess(self, image_bytes: bytes) -> "torch.Tensor":
        """Resize, normalize, convert to tensor."""
        pass
```

### 3. app/diagnosis/service.py

**DiagnosisService** class:

- `diagnose(farmer_id, image_file, crop_id)`:
  1. Validate image (JPEG/PNG, ≤10MB)
  2. Upload image to storage (R2 or local), get URL
  3. Run CNN inference → top-3 predictions
  4. Apply confidence routing:
     - `>= 0.70`: "Diagnosis: {label}" — high confidence
     - `0.40 - 0.70`: "Possible: {label}" — medium, include disclaimer
     - `< 0.40`: "Uncertain" — recommend consulting extension officer
  5. Generate Sinhala treatment advice via OpenRouter (only if confidence >= 0.40)
  6. Store diagnosis record in DB
  7. Return full diagnosis response

- `generate_advice(classification, crop_name, confidence, language)`:
  - Calls OpenRouter with this system prompt:
    ```
    You are an agricultural advisor for Sri Lankan farmers.
    Respond ONLY in {language}. Given this crop disease diagnosis: {classification}
    for crop: {crop_name} with confidence: {confidence}%,
    provide practical treatment advice using locally available inputs.
    Cite Department of Agriculture recommendations where applicable.
    Keep response under 200 words. Be specific about:
    1. Immediate actions the farmer should take
    2. Recommended treatments (organic and chemical options available in Sri Lanka)
    3. Prevention measures for future crops
    ```
  - Use `temperature=0.3` for consistency
  - Use `max_tokens=500` to keep costs minimal
  - If OpenRouter fails, return fallback: "කරුණාකර ඔබේ ගොවිපළ උපදේශකයා හමුවන්න" (Please consult your agricultural extension officer)

- `get_diagnosis(diagnosis_id, user_id)` → Verify ownership
- `list_diagnosis_history(farmer_id, filters)` → Paginated history
- `submit_feedback(diagnosis_id, farmer_id, feedback)` → Update user_feedback field

### 4. app/diagnosis/router.py

```
POST   /diagnosis/upload              — Upload image, get diagnosis + advice (farmer only)
GET    /diagnosis/history             — My diagnosis history (farmer only)
GET    /diagnosis/{id}                — Single diagnosis detail
POST   /diagnosis/{id}/feedback       — Submit feedback on diagnosis accuracy
```

Rate limit: 30 requests/minute on upload endpoint (configured in nginx).

### 5. Startup Integration

In `app/main.py` lifespan, load the CNN model at startup:
```python
from app.diagnosis.cnn import CropDiseaseCNN

cnn_model = CropDiseaseCNN()

@asynccontextmanager
async def lifespan(app):
    await cnn_model.load_model()
    app.state.cnn_model = cnn_model
    yield
```

Make the model accessible via dependency injection:
```python
def get_cnn_model(request: Request) -> CropDiseaseCNN:
    return request.app.state.cnn_model
```

### 6. Register Router

Add diagnosis router to main.py.

## Verification

1. Image upload accepts JPEG/PNG, rejects others
2. CNN prediction returns top-3 with confidence scores
3. Confidence routing applies correct thresholds
4. OpenRouter generates Sinhala advice
5. Fallback message returned when OpenRouter fails
6. Diagnosis history is paginated and filtered
7. Feedback submission works
8. Rate limiting is documented

## Output Report
Write report to: `/home/claude/govihub-prompts/reports/REPORT_07_DIAGNOSIS.md`
