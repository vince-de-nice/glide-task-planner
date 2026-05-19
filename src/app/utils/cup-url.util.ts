/**
 * Valide une URL CUP pour chargement côté navigateur (?cup=).
 * Autorise chemins relatifs same-origin et https.
 */
export function isAllowedCupFetchUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) {
    return false;
  }

  if (trimmed.startsWith('/')) {
    return !trimmed.startsWith('//');
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:') {
      return true;
    }
    if (parsed.protocol === 'http:' && isLocalhost(parsed.hostname)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function isLocalhost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

export function cupUrlRejectionMessage(url: string): string {
  return `URL CUP non autorisée : ${url.trim().slice(0, 80)}`;
}
