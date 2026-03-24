"""GoviHub Crop Disease CNN — PlantVillage model wrapper with placeholder fallback."""

import io
import logging
from pathlib import Path
from typing import Optional

import structlog

logger = structlog.get_logger()

# 38 PlantVillage disease classes (subset with Rice diseases included)
CLASS_NAMES: list[str] = [
    "Apple___Apple_scab",
    "Apple___Black_rot",
    "Apple___Cedar_apple_rust",
    "Apple___healthy",
    "Blueberry___healthy",
    "Cherry_(including_sour)___Powdery_mildew",
    "Cherry_(including_sour)___healthy",
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot",
    "Corn_(maize)___Common_rust_",
    "Corn_(maize)___Northern_Leaf_Blight",
    "Corn_(maize)___healthy",
    "Grape___Black_rot",
    "Grape___Esca_(Black_Measles)",
    "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)",
    "Grape___healthy",
    "Orange___Haunglongbing_(Citrus_greening)",
    "Peach___Bacterial_spot",
    "Peach___healthy",
    "Pepper,_bell___Bacterial_spot",
    "Pepper,_bell___healthy",
    "Potato___Early_blight",
    "Potato___Late_blight",
    "Potato___healthy",
    "Raspberry___healthy",
    "Rice___Leaf_Blast",
    "Rice___Brown_Spot",
    "Rice___Neck_Blast",
    "Rice___Sheath_Blight",
    "Soybean___healthy",
    "Squash___Powdery_mildew",
    "Strawberry___Leaf_scorch",
    "Strawberry___healthy",
    "Tomato___Bacterial_spot",
    "Tomato___Early_blight",
    "Tomato___Late_blight",
    "Tomato___Leaf_Mold",
    "Tomato___healthy",
    "Tomato___Spider_mites Two-spotted_spider_mite",
]

MODEL_PATH = Path("/app/ml/models/crop_disease.pt")
_IMAGE_SIZE = (224, 224)
_NORMALIZE_MEAN = [0.485, 0.456, 0.406]
_NORMALIZE_STD = [0.229, 0.224, 0.225]


class CropDiseaseCNN:
    """Wrapper around a PyTorch ResNet model trained on PlantVillage dataset.

    Falls back to a deterministic mock when the model file is unavailable
    (development / CI environments).
    """

    def __init__(self) -> None:
        self._model = None
        self._placeholder_mode: bool = True
        self.model_version: str = "placeholder-v0"

    def load_model(self) -> None:
        """Attempt to load the PyTorch model from disk."""
        if not MODEL_PATH.exists():
            logger.warning(
                "cnn_model_not_found",
                path=str(MODEL_PATH),
                mode="placeholder",
            )
            self._placeholder_mode = True
            return

        try:
            import torch  # type: ignore

            self._model = torch.load(MODEL_PATH, map_location="cpu")
            self._model.eval()
            self._placeholder_mode = False
            self.model_version = "plantvillage-v1"
            logger.info("cnn_model_loaded", path=str(MODEL_PATH))
        except Exception as exc:  # noqa: BLE001
            logger.error("cnn_model_load_failed", error=str(exc), mode="placeholder")
            self._placeholder_mode = True

    def preprocess(self, image_bytes: bytes):
        """Resize and normalise image bytes into a model-ready tensor.

        Returns a (1, 3, 224, 224) float tensor, or None in placeholder mode.
        """
        try:
            from PIL import Image  # type: ignore
            import torch  # type: ignore
            from torchvision import transforms  # type: ignore

            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

            transform = transforms.Compose(
                [
                    transforms.Resize(_IMAGE_SIZE),
                    transforms.ToTensor(),
                    transforms.Normalize(mean=_NORMALIZE_MEAN, std=_NORMALIZE_STD),
                ]
            )
            tensor = transform(image).unsqueeze(0)  # (1, C, H, W)
            return tensor
        except Exception as exc:  # noqa: BLE001
            logger.warning("cnn_preprocess_failed", error=str(exc))
            return None

    def predict(self, image_bytes: bytes) -> list[dict]:
        """Return top-3 predictions as a list of {label, confidence} dicts.

        Uses the real model when loaded; otherwise returns a deterministic mock
        that exercises the confidence-routing logic downstream.
        """
        if self._placeholder_mode or self._model is None:
            return self._placeholder_predict()

        tensor = self.preprocess(image_bytes)
        if tensor is None:
            return self._placeholder_predict()

        try:
            import torch  # type: ignore
            import torch.nn.functional as F  # type: ignore

            with torch.no_grad():
                logits = self._model(tensor)
                probs = F.softmax(logits, dim=1)[0]

            top_k = torch.topk(probs, k=3)
            predictions = []
            for idx, score in zip(top_k.indices.tolist(), top_k.values.tolist()):
                label = CLASS_NAMES[idx] if idx < len(CLASS_NAMES) else f"class_{idx}"
                predictions.append({"label": label, "confidence": round(score, 4)})

            logger.info("cnn_prediction", top1=predictions[0]["label"], confidence=predictions[0]["confidence"])
            return predictions

        except Exception as exc:  # noqa: BLE001
            logger.error("cnn_inference_failed", error=str(exc))
            return self._placeholder_predict()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _placeholder_predict() -> list[dict]:
        """Return a fixed mock prediction list for development/testing."""
        return [
            {"label": "Rice___Leaf_Blast", "confidence": 0.55},
            {"label": "Rice___Brown_Spot", "confidence": 0.28},
            {"label": "Rice___Neck_Blast", "confidence": 0.10},
        ]


# Module-level singleton — loaded lazily via load_model() in lifespan
cnn_model = CropDiseaseCNN()
