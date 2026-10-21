"""Servidor MCP para disponibilizar a ferramenta avaliar_decisao aos agentes do Antigravity."""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, List, Optional, Union

from fastmcp import FastMCP
from laya_decision.evaluator import avaliar_decisao

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("laya_decision.mcp_server")

# Criação da instância do servidor FastMCP
mcp = FastMCP(
    "laya-decision",
    instructions="Servidor de decisão estruturada baseado na Laya AI para apoio a agentes do Antigravity.",
)


@mcp.tool(
    name="avaliar_decisao",
    description=(
        "Avalia uma decisão estruturada utilizando a Laya AI. "
        "Suporta múltipla escolha ('choice'), escala ordinal ('score') e sim/não ('noul'). "
        "Preserva a calibragem de probabilidades e aplica travas de segurança contra ações críticas autônomas."
    ),
)
async def tool_avaliar_decisao(
    contexto: str,
    pergunta: str,
    tipo_decisao: str = "choice",
    opcoes: Optional[Union[Dict[str, str], List[str]]] = None,
    threshold: Optional[float] = None,
    acao_proposta: Optional[str] = None,
) -> Dict[str, Any]:
    """Executa a avaliação de decisão estruturada com a Laya AI.

    Args:
        contexto: Texto/documento com o contexto factual a ser analisado (tratado como dados).
        pergunta: Pergunta ou instrução objetiva a ser respondida pelo modelo.
        tipo_decisao: Tipo da decisão ('choice', 'score' ou 'noul').
        opcoes: Lista de opções ou dict de critérios/rótulos para avaliar.
        threshold: Limiar de confiança calibrada mínimo requerido (0.0 a 1.0).
        acao_proposta: Opcional, nome da ação a ser executada com base no resultado (para checagem de segurança).

    Returns:
        Dicionário com o resultado estruturado da decisão, métricas de confiança e flags de segurança.
    """
    logger.info("Requisição avaliar_decisao recebida via MCP [tipo=%s]", tipo_decisao)
    resultado = await avaliar_decisao(
        contexto=contexto,
        pergunta=pergunta,
        tipo_decisao=tipo_decisao,
        opcoes=opcoes,
        threshold=threshold,
        acao_proposta=acao_proposta,
    )
    return resultado


def main():
    """Ponto de entrada para execução via stdio."""
    logger.info("Iniciando servidor MCP Laya Decision via stdio...")
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
