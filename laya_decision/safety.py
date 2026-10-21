"""Políticas de segurança, sanitização e barreira contra ações críticas autônomas."""

from __future__ import annotations

import re
from typing import Optional, Tuple

# Padrões de ações de alto risco que NUNCA podem ser autorizadas automaticamente
CRITICAL_ACTION_PATTERNS = [
    (r"\b(delete|excluir|remover|apagar|unlink|rm|drop|purge)\b", "exclusão de arquivos ou recursos"),
    (r"\b(deploy|publicar|publish|release|promover para producao|production)\b", "publicação ou deploy em produção"),
    (r"\b(pagar|pagamento|comprar|compra|pay|payment|charge|checkout|billing)\b", "compras ou pagamentos financeiros"),
    (r"\b(enviar mensagem|send message|email|e-mail|slack|notify|notificar|tweet|post)\b", "envio de mensagens ou comunicações externas"),
    (r"\b(alterar producao|production edit|write prod|drop table|truncate|migrate db)\b", "alterações diretas em ambiente de produção"),
    (r"\b(token|secret|password|senha|api_key|credential|credencial|chave privada)\b", "acesso ou exposição de dados sensíveis ou credenciais"),
]


def check_critical_action(action_text: Optional[str], question_text: Optional[str] = None) -> Tuple[bool, Optional[str]]:
    """Verifica se a ação proposta ou contexto contém intenções de alto risco.

    Retorna (is_critical, motivo_bloqueio).
    """
    text_to_scan = f"{action_text or ''} {question_text or ''}".lower()
    if not text_to_scan.strip():
        return False, None

    for pattern, description in CRITICAL_ACTION_PATTERNS:
        if re.search(pattern, text_to_scan):
            return True, f"Ação de alto risco detectada ({description}). Exige autorização humana explícita."

    return False, None


def sanitize_context_as_data(context: str, max_chars: int) -> str:
    """Higieniza e delimita o texto de contexto como dados inertes.

    Previne que injeções de prompt no documento tentem sobrescrever as regras
    do avaliador de decisão.
    """
    if not context:
        return ""

    # Trunca se exceder limite
    trimmed = context[:max_chars]

    # Delimita explicitamente para tratamento puramente de dados
    return f"<DATA_INPUT>\n{trimmed}\n</DATA_INPUT>"
