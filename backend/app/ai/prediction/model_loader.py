"""Prediction model loader with MLflow integration and file-based fallback.

Graceful degradation:
  1. Try MLflow model registry → champion model
  2. Try file-based model storage
  3. Fall back to heuristic median estimates
"""

from __future__ import annotations

import logging
import os
import pickle
from pathlib import Path

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class ModelLoader:
    """Load ML models with cascading fallback strategy."""

    def __init__(self) -> None:
        self._models: dict[str, object] = {}
        self._metadata: dict[str, dict] = {}

    def load_model(self, model_name: str) -> object | None:
        """Load a model by name. Returns None if unavailable.

        Tries: MLflow → file → returns None (caller uses heuristic).
        """
        if model_name in self._models:
            return self._models[model_name]

        # Try file-based loading
        model = self._load_from_file(model_name)
        if model is not None:
            self._models[model_name] = model
            return model

        # Try MLflow
        model = self._load_from_mlflow(model_name)
        if model is not None:
            self._models[model_name] = model
            return model

        logger.warning("No model found for '%s' — will use heuristic", model_name)
        return None

    def get_model_metadata(self, model_name: str) -> dict:
        """Get metadata for a loaded model."""
        return self._metadata.get(model_name, {
            "version": "heuristic",
            "data_source": "synthetic",
            "is_heuristic": True,
        })

    def _load_from_file(self, model_name: str) -> object | None:
        """Try loading from file-based storage."""
        settings = get_settings()
        model_dir = Path(settings.MODEL_STORAGE_DIR)
        model_path = model_dir / f"{model_name}.pkl"

        if not model_path.exists():
            return None

        try:
            with open(model_path, "rb") as f:
                data = pickle.load(f)

            if isinstance(data, dict) and "model" in data:
                self._metadata[model_name] = {
                    "version": data.get("version", "v1-file"),
                    "data_source": data.get("data_source", "synthetic"),
                    "is_heuristic": False,
                    "metrics": data.get("metrics", {}),
                }
                return data["model"]
            else:
                self._metadata[model_name] = {
                    "version": "v1-file",
                    "data_source": "synthetic",
                    "is_heuristic": False,
                }
                return data
        except Exception as e:
            logger.error("Failed to load model from file '%s': %s", model_path, e)
            return None

    def _load_from_mlflow(self, model_name: str) -> object | None:
        """Try loading the production model from MLflow registry."""
        try:
            import mlflow

            settings = get_settings()
            mlflow.set_tracking_uri(settings.MLFLOW_TRACKING_URI)

            model = mlflow.sklearn.load_model(f"models:/{model_name}/Production")
            self._metadata[model_name] = {
                "version": f"mlflow-production",
                "data_source": "synthetic",
                "is_heuristic": False,
            }
            return model
        except Exception as e:
            logger.debug("MLflow model load failed for '%s': %s", model_name, e)
            return None

    def save_model_to_file(
        self,
        model_name: str,
        model: object,
        version: str = "v1",
        data_source: str = "synthetic",
        metrics: dict | None = None,
    ) -> Path:
        """Save a model to file-based storage."""
        settings = get_settings()
        model_dir = Path(settings.MODEL_STORAGE_DIR)
        model_dir.mkdir(parents=True, exist_ok=True)
        model_path = model_dir / f"{model_name}.pkl"

        data = {
            "model": model,
            "version": version,
            "data_source": data_source,
            "metrics": metrics or {},
        }

        with open(model_path, "wb") as f:
            pickle.dump(data, f)

        logger.info("Saved model '%s' to %s", model_name, model_path)
        return model_path
