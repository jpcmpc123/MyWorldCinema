const RAW_API_BASE_URL =
  ((import.meta as { env?: Record<string, string | undefined> }).env?.VITE_API_BASE_URL ?? '').trim();

export const API_BASE_URL = RAW_API_BASE_URL.replace(/\/+$/, '');

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}
