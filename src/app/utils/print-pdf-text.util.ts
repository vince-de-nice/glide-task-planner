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

/** Découpe un texte pour tenir dans une largeur PDF (points). */
export function wrapPdfTextLines(
  text: string,
  maxWidth: number,
  measure: (line: string) => number
): string[] {
  const sanitized = sanitizePdfText(text);
  if (!sanitized.trim()) return [];
  const words = sanitized.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    if (measure(word) <= maxWidth) {
      current = word;
      continue;
    }
    let chunk = '';
    for (const ch of word) {
      const next = chunk + ch;
      if (measure(next) > maxWidth && chunk) {
        lines.push(chunk);
        chunk = ch;
      } else {
        chunk = next;
      }
    }
    current = chunk;
  }
  if (current) lines.push(current);
  return lines;
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
    if (cp === 0x2192) {
      out += '->';
      continue;
    }
    if (cp === 0x2194) {
      out += '<->';
      continue;
    }
    if (cp === 0x00b7) {
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
  return out.replace(/\s{2,}/g, ' ').trim();
}
