/** Fréquences POAFF structurées (ex. `{ TWR: ["124.0"], APP: ["120.205"] }`). */
export type PoaffMhzMap = Record<string, string[]>;

/** Lignes lisibles pour impression / récap (ex. `TWR: 124.0 MHz`). */
export function formatPoaffMhzLines(mhz: PoaffMhzMap | undefined): string[] {
  if (!mhz) return [];
  const lines: string[] = [];
  for (const [role, values] of Object.entries(mhz)) {
    if (!values?.length) continue;
    const roleLabel = role.trim() || 'FREQ';
    for (const raw of values) {
      const v = raw?.trim();
      if (!v) continue;
      if (/^TEL:/i.test(v)) {
        lines.push(`${roleLabel}: ${v}`);
        continue;
      }
      const freq = v.replace(/\*+$/, '').trim();
      if (/MHz/i.test(freq)) {
        lines.push(`${roleLabel}: ${freq}`);
      } else if (/^\d{3}(\.\d+)?$/.test(freq)) {
        lines.push(`${roleLabel}: ${freq} MHz`);
      } else {
        lines.push(`${roleLabel}: ${freq}`);
      }
    }
  }
  return lines;
}
