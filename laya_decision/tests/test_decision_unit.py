"""Testes unitários isolados com Mocks para o avaliador Laya Decision.

Cobre os 5 cenários exigidos pela especificação:
1. Uma decisão válida entre alternativas.
2. Entrada inválida.
3. Timeout ou serviço indisponível.
4. Resposta malformada.
5. Bloqueio de ação que exige aprovação humana.
"""

from __future__ import annotations

import asyncio
import unittest
from unittest.mock import AsyncMock, MagicMock

from laya_decision.evaluator import LayaDecisionEvaluator
from laya_decision.models import DecisionType


class MockLayaAdapter:
    """Mock explícito do adaptador LayaEngineAdapter para testes unitários isolados."""

    def __init__(self):
        self.predict_async = AsyncMock()


class TestLayaDecisionUnit(unittest.IsolatedAsyncioTestCase):
    """Testes unitários usando Mocks explícitos."""

    def setUp(self):
        self.mock_adapter = MockLayaAdapter()
        self.evaluator = LayaDecisionEvaluator(adapter=self.mock_adapter)

    # --------------------------------------------------------------------------
    # CENÁRIO 1: Decisão válida entre alternativas (ex: bug vs melhoria vs duvida)
    # --------------------------------------------------------------------------
    async def test_01_valid_choice_decision(self):
        """Cenário 1: Classificação válida de ticket com opções bug, melhoria, duvida."""
        self.mock_adapter.predict_async.return_value = {
            "model": "convaiinnovations/laya-mock",
            "answers": {
                "decision_q0": {
                    "type": "choice",
                    "choice": "bug",
                    "probabilities": {"bug": 0.95, "melhoria": 0.03, "duvida": 0.02},
                    "confidence": 0.95,
                    "answer_confidence": 0.95,
                }
            },
            "usage": {"input_tokens": 40, "output_tokens": 0},
        }

        resp = await self.evaluator.avaliar_decisao(
            contexto="Ao tentar salvar o filme nos favoritos, o app trava e fecha inesperadamente.",
            pergunta="Qual é a categoria deste ticket de suporte?",
            tipo_decisao="choice",
            opcoes=["bug", "melhoria", "duvida"],
            threshold=0.7,
        )

        self.assertEqual(resp.status, "success")
        self.assertEqual(resp.decisao, "bug")
        self.assertAlmostEqual(resp.confianca, 0.95)
        self.assertTrue(resp.confianca_valida)
        self.assertFalse(resp.requer_aprovacao_humana)
        self.assertTrue(resp.acao_autorizada)
        self.assertIn("bug", resp.probabilidades)

    # --------------------------------------------------------------------------
    # CENÁRIO 2: Entrada inválida
    # --------------------------------------------------------------------------
    async def test_02_invalid_input_empty_options(self):
        """Cenário 2.1: Entrada inválida - tipo 'choice' sem opções fornecidas."""
        resp = await self.evaluator.avaliar_decisao(
            contexto="Texto válido",
            pergunta="Pergunta válida",
            tipo_decisao="choice",
            opcoes=[],  # Inválido: lista vazia para choice
        )
        self.assertEqual(resp.status, "error")
        self.assertIsNone(resp.decisao)
        self.assertTrue(resp.requer_aprovacao_humana)
        self.assertFalse(resp.acao_autorizada)
        self.assertIn("opcoes", resp.motivo_bloqueio.lower())

    async def test_02_invalid_input_unsupported_type(self):
        """Cenário 2.2: Entrada inválida - tipo de decisão não suportado."""
        resp = await self.evaluator.avaliar_decisao(
            contexto="Texto válido",
            pergunta="Pergunta válida",
            tipo_decisao="tipo_inexistente",
        )
        self.assertEqual(resp.status, "error")
        self.assertIsNone(resp.decisao)
        self.assertTrue(resp.requer_aprovacao_humana)
        self.assertFalse(resp.acao_autorizada)

    async def test_02_invalid_input_context_too_large(self):
        """Cenário 2.3: Entrada inválida - contexto excedendo o limite de caracteres."""
        contexto_gigante = "A" * 5000  # Limite padrão é 4000
        resp = await self.evaluator.avaliar_decisao(
            contexto=contexto_gigante,
            pergunta="Pergunta qualquer",
            tipo_decisao="choice",
            opcoes=["opcao1", "opcao2"],
        )
        self.assertEqual(resp.status, "error")
        self.assertIn("excede o limite máximo permitido", resp.motivo_bloqueio)
        self.assertTrue(resp.requer_aprovacao_humana)
        self.assertFalse(resp.acao_autorizada)

    # --------------------------------------------------------------------------
    # CENÁRIO 3: Timeout ou serviço indisponível
    # --------------------------------------------------------------------------
    async def test_03_timeout_handling(self):
        """Cenário 3.1: Timeout durante inferência do modelo."""
        self.mock_adapter.predict_async.side_effect = TimeoutError("Operação excedeu 15 segundos")

        resp = await self.evaluator.avaliar_decisao(
            contexto="Log de erro do sistema",
            pergunta="Classificar erro",
            tipo_decisao="choice",
            opcoes=["critico", "moderado"],
        )
        self.assertEqual(resp.status, "error")
        self.assertIsNone(resp.decisao)
        self.assertTrue(resp.requer_aprovacao_humana)
        self.assertFalse(resp.acao_autorizada)
        self.assertIn("tempo limite esgotado", resp.motivo_bloqueio.lower())

    async def test_03_service_unavailable(self):
        """Cenário 3.2: Serviço indisponível ou queda do motor de IA."""
        self.mock_adapter.predict_async.side_effect = RuntimeError("Conexão com modelo recusada")

        resp = await self.evaluator.avaliar_decisao(
            contexto="Log de erro do sistema",
            pergunta="Classificar erro",
            tipo_decisao="choice",
            opcoes=["critico", "moderado"],
        )
        self.assertEqual(resp.status, "error")
        self.assertIsNone(resp.decisao)
        self.assertTrue(resp.requer_aprovacao_humana)
        self.assertFalse(resp.acao_autorizada)
        self.assertIn("erro na execução", resp.motivo_bloqueio.lower())

    # --------------------------------------------------------------------------
    # CENÁRIO 4: Resposta malformada
    # --------------------------------------------------------------------------
    async def test_04_malformed_response(self):
        """Cenário 4: Motor retorna resposta incompleta sem chave 'answers'."""
        self.mock_adapter.predict_async.return_value = {
            "status": "ok",  # Resposta corrompida sem 'answers'
            "dados_errados": 123,
        }

        resp = await self.evaluator.avaliar_decisao(
            contexto="Ticket teste",
            pergunta="Classificar",
            tipo_decisao="choice",
            opcoes=["a", "b"],
        )
        self.assertEqual(resp.status, "error")
        self.assertIsNone(resp.decisao)
        self.assertTrue(resp.requer_aprovacao_humana)
        self.assertFalse(resp.acao_autorizada)
        self.assertIn("malformada", resp.motivo_bloqueio.lower())

    # --------------------------------------------------------------------------
    # CENÁRIO 5: Bloqueio de ação que exige aprovação humana
    # --------------------------------------------------------------------------
    async def test_05_block_critical_action_file_deletion(self):
        """Cenário 5.1: Bloqueio de exclusão de arquivos mesmo com alta confiança do modelo."""
        self.mock_adapter.predict_async.return_value = {
            "model": "convaiinnovations/laya-mock",
            "answers": {
                "decision_q0": {
                    "type": "choice",
                    "choice": "sim",
                    "probabilities": {"sim": 0.99, "nao": 0.01},
                    "confidence": 0.99,
                    "answer_confidence": 0.99,
                }
            },
        }

        resp = await self.evaluator.avaliar_decisao(
            contexto="Arquivo de cache antigo encontrado em disco.",
            pergunta="Devo excluir o diretório e apagar os arquivos permanentemente?",
            tipo_decisao="choice",
            opcoes=["sim", "nao"],
            acao_proposta="rm -rf /var/data/cache e apagar arquivos",
        )

        self.assertEqual(resp.status, "blocked")
        self.assertEqual(resp.decisao, "sim")
        self.assertTrue(resp.requer_aprovacao_humana)
        self.assertFalse(resp.acao_autorizada)  # NUNCA autoriza automaticamente
        self.assertIn("exclusão de arquivos", resp.motivo_bloqueio.lower())

    async def test_05_block_critical_action_payment(self):
        """Cenário 5.2: Bloqueio de ação financeira / compras."""
        self.mock_adapter.predict_async.return_value = {
            "model": "convaiinnovations/laya-mock",
            "answers": {
                "decision_q0": {
                    "type": "choice",
                    "choice": "aprovar",
                    "confidence": 0.98,
                    "answer_confidence": 0.98,
                }
            },
        }

        resp = await self.evaluator.avaliar_decisao(
            contexto="Fatura mensal do servidor AWS no valor de $500.",
            pergunta="Deseja realizar o pagamento da fatura?",
            tipo_decisao="choice",
            opcoes=["aprovar", "recusar"],
            acao_proposta="executar pagamento do cartao",
        )

        self.assertEqual(resp.status, "blocked")
        self.assertTrue(resp.requer_aprovacao_humana)
        self.assertFalse(resp.acao_autorizada)
        self.assertIn("pagamentos", resp.motivo_bloqueio.lower())

    async def test_05_block_critical_action_deploy(self):
        """Cenário 5.3: Bloqueio de deploy em produção."""
        self.mock_adapter.predict_async.return_value = {
            "model": "convaiinnovations/laya-mock",
            "answers": {
                "decision_q0": {
                    "type": "choice",
                    "choice": "sim",
                    "confidence": 0.95,
                    "answer_confidence": 0.95,
                }
            },
        }

        resp = await self.evaluator.avaliar_decisao(
            contexto="Release v2.0 pronta.",
            pergunta="Publicar release?",
            tipo_decisao="choice",
            opcoes=["sim", "nao"],
            acao_proposta="deploy para producao",
        )

        self.assertEqual(resp.status, "blocked")
        self.assertTrue(resp.requer_aprovacao_humana)
        self.assertFalse(resp.acao_autorizada)
        self.assertIn("produção", resp.motivo_bloqueio.lower())


if __name__ == "__main__":
    unittest.main()
