"""Módulo de configuração do serviço de decisão Laya."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class LayaConfig:
    model_id: str
    device: Optional[str]
    timeout_seconds: float
    max_context_chars: int
    min_confidence_threshold: float
    log_level: str
    offline_only: bool

    @classmethod
    def from_env(cls) -> LayaConfig:
        model_id = os.getenv("LAYA_MODEL_ID", "convaiinnovations/laya").strip()
        device = os.getenv("LAYA_DEVICE", "cpu").strip() or None
        
        try:
            timeout_seconds = float(os.getenv("LAYA_TIMEOUT_SECONDS", "15.0"))
        except ValueError:
            timeout_seconds = 15.0

        try:
            max_context_chars = int(os.getenv("LAYA_MAX_CONTEXT_CHARS", "4000"))
        except ValueError:
            max_context_chars = 4000

        try:
            min_confidence_threshold = float(os.getenv("LAYA_MIN_CONFIDENCE_THRESHOLD", "0.7"))
        except ValueError:
            min_confidence_threshold = 0.7

        log_level = os.getenv("LAYA_LOG_LEVEL", "INFO").strip().upper()
        offline_only = os.getenv("LAYA_OFFLINE_ONLY", "true").lower() in ("true", "1", "yes")

        return cls(
            model_id=model_id,
            device=device,
            timeout_seconds=timeout_seconds,
            max_context_chars=max_context_chars,
            min_confidence_threshold=min_confidence_threshold,
            log_level=log_level,
            offline_only=offline_only,
        )


# Instância global padrão
config = LayaConfig.from_env()
