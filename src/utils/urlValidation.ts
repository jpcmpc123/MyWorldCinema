/**
 * Valida se uma URL fornecida pelo usuário utiliza estritamente os protocolos
 * seguros http:// ou https:// (bloqueando javascript:, data:, vbscript:, file:, etc.).
 */
export function isSafeHttpUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (!/^https?:\/\//i.test(trimmed)) return false;
  try {
    const parsed = new URL(trimmed);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      Boolean(parsed.hostname)
    );
  } catch {
    return false;
  }
}

/**
 * Retorna a URL sanitizada se for http:// ou https://, ou string vazia caso contrário.
 */
export function sanitizeHttpUrl(raw: string | null | undefined): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  return isSafeHttpUrl(trimmed) ? trimmed : '';
}

/**
 * Sanitiza URLs usadas em tags <img> (permite http://, https:// ou caminhos locais '/...').
 */
export function sanitizeAvatarSrc(raw: string | null | undefined): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (isSafeHttpUrl(trimmed)) return trimmed;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  return '';
}
