/** Lit une clé localStorage, ou migre depuis d’anciennes clés `vav_*` puis les supprime. */
export function readMigratedLocalStorage(primaryKey: string, legacyVavKeys: string[]): string | null {
  const current = localStorage.getItem(primaryKey);
  if (current !== null) return current;
  for (const legacy of legacyVavKeys) {
    const raw = localStorage.getItem(legacy);
    if (raw === null) continue;
    localStorage.setItem(primaryKey, raw);
    localStorage.removeItem(legacy);
    return raw;
  }
  return null;
}
