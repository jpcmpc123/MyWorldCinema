"""Módulo adaptador para o motor de inferência da Laya AI."""

from __future__ import annotations

import asyncio
import logging
import os
import threading
from typing import Any, Dict, Optional

from laya_decision.config import config

logger = logging.getLogger("laya_decision.engine")

# Bloqueio para carregamento thread-safe do modelo singleton
_model_lock = threading.Lock()
_global_agent = None


def get_laya_agent(custom_model_id: Optional[str] = None):
    """Carrega sob demanda (lazy loading) e retorna o agente Laya em memória."""
    global _global_agent
    if _global_agent is not None:
        return _global_agent

    with _model_lock:
        if _global_agent is not None:
            return _global_agent

        try:
            import laya

            # Configura HuggingFace para modo offline caso solicitado
            if config.offline_only:
                os.environ["HF_HUB_OFFLINE"] = "1"
                os.environ["TRANSFORMERS_OFFLINE"] = "1"

            model_target = custom_model_id or config.model_id
            logger.info("Carregando modelo Laya: %s (device=%s)", model_target, config.device)
            _global_agent = laya.load(model_target, device=config.device)
            logger.info("Modelo Laya carregado com sucesso.")
            return _global_agent
        except Exception as exc:
            logger.error("Falha ao inicializar motor Laya: %s", exc, exc_info=True)
            raise RuntimeError(f"Serviço Laya indisponível: {exc}") from exc


def reset_laya_agent():
    """Reinicia o agente singleton (útil para testes)."""
    global _global_agent
    with _model_lock:
        _global_agent = None


class LayaEngineAdapter:
    """Adaptador de execução de inferências com controle de timeout e cancelamento."""

    def __init__(self, agent_instance=None):
        self._custom_agent = agent_instance

    def _get_agent(self):
        if self._custom_agent is not None:
            return self._custom_agent
        return get_laya_agent()

    async def predict_async(
        self,
        state: str,
        questions: Dict[str, Any],
        timeout_seconds: Optional[float] = None,
    ) -> Dict[str, Any]:
        """Executa a predição assíncrona com timeout estrito."""
        effective_timeout = timeout_seconds or config.timeout_seconds
        agent = self._get_agent()

        # O predict nativo da Laya é síncrono (computação CPU/GPU Torch),
        # portanto despachamos para threadpool evitando travar o loop de eventos.
        loop = asyncio.get_running_loop()

        try:
            prediction = await asyncio.wait_for(
                loop.run_in_executor(None, agent.predict, state, questions),
                timeout=effective_timeout,
            )
            return prediction
        except asyncio.TimeoutError as te:
            logger.warning("Tempo limite de inferência excedido (%s segundos)", effective_timeout)
            raise TimeoutError(f"Tempo limite excedido ({effective_timeout}s) ao consultar motor Laya.") from te
        except Exception as exc:
            logger.error("Erro durante a predição do modelo Laya: %s", exc)
            raise
