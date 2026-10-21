"""Teste de integração REAL com o modelo Laya AI local (convaiinnovations/laya).

Executa inferência real contra os pesos em cache local para os 3 casos do exemplo:
- bug
- melhoria
- dúvida
"""

from __future__ import annotations

import unittest
from laya_decision.evaluator import LayaDecisionEvaluator


class TestLayaDecisionReal(unittest.IsolatedAsyncioTestCase):
    """Teste de integração real com a Laya AI local."""

    async def asyncSetUp(self):
        self.evaluator = LayaDecisionEvaluator()
        self.criterios = {
            "bug": "system error, defect, failure, or crash",
            "melhoria": "feature request, enhancement, optimization, or suggestion",
            "duvida": "how-to question, inquiry, account help, or asking how to do something",
        }

    async def test_real_ticket_classification_bug(self):
        """Teste real: Classificação de ticket de bug."""
        ticket_bug = "Application crashes with error 500 when saving film to list."
        resp = await self.evaluator.avaliar_decisao(
            contexto=ticket_bug,
            pergunta="What is the category of this support request?",
            tipo_decisao="choice",
            opcoes=self.criterios,
            threshold=0.6,
        )

        print("\n[TESTE REAL - BUG]")
        print(f"Decisão: {resp.decisao}")
        print(f"Confiança: {resp.confianca:.4f}")
        print(f"Probabilidades: {resp.probabilidades}")
        print(f"Status: {resp.status}")

        self.assertEqual(resp.status, "success")
        self.assertEqual(resp.decisao, "bug")
        self.assertTrue(resp.confianca_valida)
        self.assertTrue(resp.acao_autorizada)
        self.assertFalse(resp.requer_aprovacao_humana)

    async def test_real_ticket_classification_melhoria(self):
        """Teste real: Classificação de ticket de melhoria."""
        ticket_melhoria = "Please add a CSV export button to the film collection list."
        resp = await self.evaluator.avaliar_decisao(
            contexto=ticket_melhoria,
            pergunta="What is the category of this support request?",
            tipo_decisao="choice",
            opcoes=self.criterios,
            threshold=0.6,
        )

        print("\n[TESTE REAL - MELHORIA]")
        print(f"Decisão: {resp.decisao}")
        print(f"Confiança: {resp.confianca:.4f}")
        print(f"Probabilidades: {resp.probabilidades}")
        print(f"Status: {resp.status}")

        self.assertEqual(resp.status, "success")
        self.assertEqual(resp.decisao, "melhoria")
        self.assertTrue(resp.confianca_valida)
        self.assertTrue(resp.acao_autorizada)
        self.assertFalse(resp.requer_aprovacao_humana)

    async def test_real_ticket_classification_duvida(self):
        """Teste real: Classificação de ticket de dúvida."""
        ticket_duvida = "I have a question about how to configure my profile settings. Can someone help me?"
        resp = await self.evaluator.avaliar_decisao(
            contexto=ticket_duvida,
            pergunta="What is the category of this support request?",
            tipo_decisao="choice",
            opcoes=self.criterios,
            threshold=0.6,
        )

        print("\n[TESTE REAL - DÚVIDA]")
        print(f"Decisão: {resp.decisao}")
        print(f"Confiança: {resp.confianca:.4f}")
        print(f"Probabilidades: {resp.probabilidades}")
        print(f"Status: {resp.status}")

        self.assertEqual(resp.status, "success")
        self.assertEqual(resp.decisao, "duvida")
        self.assertTrue(resp.confianca_valida)
        self.assertTrue(resp.acao_autorizada)
        self.assertFalse(resp.requer_aprovacao_humana)


if __name__ == "__main__":
    unittest.main()
