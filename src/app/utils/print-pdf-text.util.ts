/**
 * Normalise le texte pour les polices PDF standard (WinAnsi / Latin-1).
 * Évite les erreurs du type « WinAnsi cannot encode » (ex. espace fine 0x202f en fr-FR).
 */
const WIN_ANSI_EXTRA: Readonly<Record<number, string>> = {
  0x20ac: 'EUR',
  0x2018: "'",
  0x2019: "'",
  0x201c: '"',
  0x201d: '"'
};

/** Chiffres avec espaces normaux (pas d’espace fine insécable). */
export function formatPdfInteger(n: number): string {
  if (!Number.isFinite(n)) return '';
  const sign = n < 0 ? '-' : '';
  const digits = Math.abs(Math.round(n)).toString();
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function sanitizePdfText(text: string): string {
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp === 0x202f || cp === 0xa0) {
      out += ' ';
      continue;
    }
    if (cp === 0x2014 || cp === 0x2013) {
      out += '-';
      continue;
    }
    if (cp <= 0xff) {
      out += ch;
      continue;
    }
    const mapped = WIN_ANSI_EXTRA[cp];
    out += mapped ?? '?';
  }
  return out;
}
