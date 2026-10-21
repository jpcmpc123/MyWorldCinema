"""Módulo de avaliação estruturada de decisões com Laya AI."""

from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional, Union

from laya_decision.config import config
from laya_decision.engine import LayaEngineAdapter
from laya_decision.models import DecisionType, DecisaoRequest, DecisaoResponse
from laya_decision.safety import check_critical_action, sanitize_context_as_data

logger = logging.getLogger("laya_decision.evaluator")


class LayaDecisionEvaluator:
    """Avaliador central de decisões estruturadas para agentes."""

    def __init__(self, adapter: Optional[LayaEngineAdapter] = None):
        self._adapter = adapter or LayaEngineAdapter()

    async def avaliar_decisao(
        self,
        contexto: str,
        pergunta: str,
        tipo_decisao: Union[str, DecisionType] = "choice",
        opcoes: Optional[Union[Dict[str, str], List[str]]] = None,
        threshold: Optional[float] = None,
        acao_proposta: Optional[str] = None,
    ) -> DecisaoResponse:
        """Avalia uma pergunta ou alternativa de decisão utilizando a Laya AI.

        Garante validação rigorosa, limites de contexto, tratamento de dados,
        verificação de segurança e controle de autorização de ações.
        """
        start_time = time.monotonic()

        # 1. Validação de limite de tamanho de contexto
        if contexto and len(contexto) > config.max_context_chars:
            msg_erro = (
                f"Contexto fornecido excede o limite máximo permitido de "
                f"{config.max_context_chars} caracteres (tamanho recebido: {len(contexto)})."
            )
            logger.warning("Rejeição de requisição: %s", msg_erro)
            return DecisaoResponse(
                status="error",
                tipo_decisao=str(tipo_decisao),
                decisao=None,
                confianca=0.0,
                confianca_valida=False,
                requer_aprovacao_humana=True,
                acao_autorizada=False,
                motivo_bloqueio=msg_erro,
                modelo_utilizado=config.model_id,
            )

        # 2. Validação e normalização de esquema via Pydantic
        try:
            req = DecisaoRequest(
                contexto=contexto,
                pergunta=pergunta,
                tipo_decisao=tipo_decisao,
                opcoes=opcoes,
                threshold=threshold,
                acao_proposta=acao_proposta,
            )
        except Exception as val_err:
            msg_erro = f"Entrada inválida para avaliação de decisão: {val_err}"
            logger.warning("Falha de validação de entrada: %s", msg_erro)
            return DecisaoResponse(
                status="error",
                tipo_decisao=str(tipo_decisao),
                decisao=None,
                confianca=0.0,
                confianca_valida=False,
                requer_aprovacao_humana=True,
                acao_autorizada=False,
                motivo_bloqueio=msg_erro,
                modelo_utilizado=config.model_id,
            )

        # 3. Barreira de Segurança: Análise de Ação Crítica
        is_critical, critical_reason = check_critical_action(req.acao_proposta, req.pergunta)

        # 4. Tratamento do contexto estritamente como DADOS
        safe_state = sanitize_context_as_data(req.contexto, config.max_context_chars)

        # 5. Montagem da questão no formato nativo da Laya
        question_id = "decision_q0"
        question_def: Dict[str, Any] = {
            "type": req.tipo_decisao.value,
            "instructions": req.pergunta,
        }

        if req.tipo_decisao == DecisionType.CHOICE:
            question_def["criteria"] = req.opcoes
        elif req.tipo_decisao == DecisionType.SCORE:
            question_def["criteria"] = req.opcoes
        elif req.tipo_decisao == DecisionType.NOUL and req.opcoes is not None:
            if isinstance(req.opcoes, dict):
                question_def["criteria"] = req.opcoes
            elif isinstance(req.opcoes, list):
                question_def["labels"] = req.opcoes

        questions_payload = {question_id: question_def}

        # 6. Execução com o motor Laya com captura de falhas e timeouts
        try:
            raw_result = await self._adapter.predict_async(safe_state, questions_payload)
        except TimeoutError as te:
            logger.error("Timeout na avaliação com a Laya: %s", te)
            return DecisaoResponse(
                status="error",
                tipo_decisao=req.tipo_decisao.value,
                decisao=None,
                confianca=0.0,
                confianca_valida=False,
                requer_aprovacao_humana=True,
                acao_autorizada=False,
                motivo_bloqueio=f"Serviço temporariamente indisponível: tempo limite esgotado ({te}).",
                modelo_utilizado=config.model_id,
            )
        except Exception as exc:
            logger.error("Falha ao invocar motor Laya: %s", exc)
            return DecisaoResponse(
                status="error",
                tipo_decisao=req.tipo_decisao.value,
                decisao=None,
                confianca=0.0,
                confianca_valida=False,
                requer_aprovacao_humana=True,
                acao_autorizada=False,
                motivo_bloqueio=f"Erro na execução da Laya AI: {exc}",
                modelo_utilizado=config.model_id,
            )

        # 7. Validação da estrutura de saída emitida pelo modelo
        if not isinstance(raw_result, dict) or "answers" not in raw_result:
            msg_malformada = "Resposta malformada recebida do motor Laya: ausência do bloco 'answers'."
            logger.error(msg_malformada)
            return DecisaoResponse(
                status="error",
                tipo_decisao=req.tipo_decisao.value,
                decisao=None,
                confianca=0.0,
                confianca_valida=False,
                requer_aprovacao_humana=True,
                acao_autorizada=False,
                motivo_bloqueio=msg_malformada,
                modelo_utilizado=config.model_id,
                resposta_bruta=raw_result if isinstance(raw_result, dict) else {},
            )

        answer_data = raw_result.get("answers", {}).get(question_id)
        if not answer_data or not isinstance(answer_data, dict):
            msg_malformada = f"Resposta malformada para a questão '{question_id}'."
            logger.error(msg_malformada)
            return DecisaoResponse(
                status="error",
                tipo_decisao=req.tipo_decisao.value,
                decisao=None,
                confianca=0.0,
                confianca_valida=False,
                requer_aprovacao_humana=True,
                acao_autorizada=False,
                motivo_bloqueio=msg_malformada,
                modelo_utilizado=config.model_id,
                resposta_bruta=raw_result,
            )

        # 8. Extração e mapeamento do valor decidido
        decided_value = None
        if req.tipo_decisao == DecisionType.CHOICE:
            decided_value = answer_data.get("choice")
        elif req.tipo_decisao == DecisionType.SCORE:
            decided_value = answer_data.get("level")
        elif req.tipo_decisao == DecisionType.NOUL:
            decided_value = answer_data.get("bool")

        # Extração de métricas de confiança calibrada
        answer_conf = answer_data.get("answer_confidence")
        if answer_conf is None:
            answer_conf = answer_data.get("confidence", 0.0)

        probabilities = answer_data.get("probabilities")
        effective_threshold = req.threshold if req.threshold is not None else config.min_confidence_threshold
        is_confidence_valid = float(answer_conf) >= effective_threshold

        # 9. Definição do status e autorização
        if is_critical:
            # Ação crítica NUNCA é autorizada automaticamente
            status_code = "blocked"
            action_authorized = False
            requires_human = True
            block_reason = critical_reason
        elif not is_confidence_valid:
            status_code = "low_confidence"
            action_authorized = False
            requires_human = True
            block_reason = f"Confiança obtida ({answer_conf:.2%}) está abaixo do limiar requerido ({effective_threshold:.2%})."
        else:
            status_code = "success"
            action_authorized = True
            requires_human = False
            block_reason = None

        elapsed = time.monotonic() - start_time
        logger.info(
            "Decisão avaliada com sucesso [tipo=%s, status=%s, valor=%s, conf=%.3f, duracao=%.2fs]",
            req.tipo_decisao.value,
            status_code,
            decided_value,
            float(answer_conf),
            elapsed,
        )

        return DecisaoResponse(
            status=status_code,
            tipo_decisao=req.tipo_decisao.value,
            decisao=decided_value,
            probabilidades=probabilities,
            confianca=float(answer_conf),
            confianca_valida=is_confidence_valid,
            requer_aprovacao_humana=requires_human,
            acao_autorizada=action_authorized,
            motivo_bloqueio=block_reason,
            modelo_utilizado=raw_result.get("model", config.model_id),
            resposta_bruta=raw_result,
        )


# Instância global padrão do avaliador
evaluator = LayaDecisionEvaluator()


async def avaliar_decisao(
    contexto: str,
    pergunta: str,
    tipo_decisao: str = "choice",
    opcoes: Any = None,
    threshold: Optional[float] = None,
    acao_proposta: Optional[str] = None,
) -> Dict[str, Any]:
    """Função de entrada para a ferramenta avaliar_decisao."""
    resp = await evaluator.avaliar_decisao(
        contexto=contexto,
        pergunta=pergunta,
        tipo_decisao=tipo_decisao,
        opcoes=opcoes,
        threshold=threshold,
        acao_proposta=acao_proposta,
    )
    return resp.model_dump()
