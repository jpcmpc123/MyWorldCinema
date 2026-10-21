"""Modelos de dados e validação de schemas para o serviço de decisão Laya."""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field, model_validator


class DecisionType(str, Enum):
    CHOICE = "choice"
    SCORE = "score"
    NOUL = "noul"


class DecisaoRequest(BaseModel):
    """Parâmetros de entrada da ferramenta avaliar_decisao."""

    contexto: str = Field(
        ...,
        description="Texto ou documento com o contexto relevante para a decisão (tratado como dados).",
    )
    pergunta: str = Field(
        ...,
        description="Pergunta ou instrução a ser avaliada pelo modelo de decisão.",
    )
    tipo_decisao: DecisionType = Field(
        default=DecisionType.CHOICE,
        description="Tipo de decisão: 'choice' (múltipla escolha), 'score' (escala ordinal) ou 'noul' (binário sim/não).",
    )
    opcoes: Optional[Union[Dict[str, str], List[str]]] = Field(
        default=None,
        description="Opções ou critérios da decisão. Para 'choice': lista de labels ou dict label->descrição. Para 'score': lista de níveis em ordem. Para 'noul': opcional dict com 'true'/'false'.",
    )
    threshold: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Limiar de confiança mínima aceitável (opcional, sobrescreve o padrão do sistema).",
    )
    acao_proposta: Optional[str] = Field(
        default=None,
        description="Nome ou descrição de ação que dependeria dessa decisão, para validação de segurança.",
    )

    @model_validator(mode="after")
    def validate_opcoes_for_type(self) -> DecisaoRequest:
        tipo = self.tipo_decisao
        opc = self.opcoes

        if tipo == DecisionType.CHOICE:
            if not opc:
                raise ValueError("Para o tipo 'choice', é obrigatório fornecer 'opcoes' como lista ou dicionário.")
            if isinstance(opc, (list, dict)) and len(opc) == 0:
                raise ValueError("Para o tipo 'choice', 'opcoes' não pode estar vazio.")

        elif tipo == DecisionType.SCORE:
            if not isinstance(opc, list) or len(opc) == 0:
                raise ValueError("Para o tipo 'score', 'opcoes' deve ser uma lista não-vazia de níveis ordenados.")

        elif tipo == DecisionType.NOUL:
            if opc is not None:
                if isinstance(opc, dict):
                    chaves = {str(k).lower() for k in opc.keys()}
                    if not chaves.issubset({"true", "false"}):
                        raise ValueError("Para o tipo 'noul', dicionário de opções deve conter apenas chaves 'true' e/ou 'false'.")
                elif not isinstance(opc, list):
                    raise ValueError("Para o tipo 'noul', opções deve ser nulo, um dict ('true'/'false') ou lista com 2 labels.")

        return self


class DecisaoResponse(BaseModel):
    """Resposta estruturada da ferramenta avaliar_decisao."""

    status: str = Field(..., description="'success', 'low_confidence', 'blocked' ou 'error'")
    tipo_decisao: str = Field(..., description="Tipo de decisão executada ('choice', 'score', 'noul')")
    decisao: Any = Field(..., description="Valor decido pelo modelo ou None em caso de falha/bloqueio")
    probabilidades: Optional[Dict[str, float]] = Field(default=None, description="Distribuição de probabilidades normalizada")
    confianca: float = Field(default=0.0, description="Nível de confiança calibrada da previsão (0.0 a 1.0)")
    confianca_valida: bool = Field(default=False, description="True se a confiança atingiu ou superou o limiar")
    requer_aprovacao_humana: bool = Field(default=True, description="True se a ação exige aprovação ou intervenção humana")
    acao_autorizada: bool = Field(default=False, description="Flag de autorização. SEMPRE False para ações críticas ou arriscadas.")
    motivo_bloqueio: Optional[str] = Field(default=None, description="Explicação detalhada caso a ação tenha sido bloqueada")
    modelo_utilizado: str = Field(default="", description="Identificador do modelo que executou a avaliação")
    resposta_bruta: Dict[str, Any] = Field(default_factory=dict, description="Payload completo e original emitido pelo modelo")
