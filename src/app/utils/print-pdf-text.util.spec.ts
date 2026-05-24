import { describe, expect, it } from 'vitest';
import { formatPdfInteger, sanitizePdfText } from './print-pdf-text.util';

describe('print-pdf-text.util', () => {
  it('replaces narrow no-break space from fr-FR locale', () => {
    const fr = (250_000).toLocaleString('fr-FR');
    expect(sanitizePdfText(`1:${fr}`)).toBe('1:250 000');
  });

  it('formats integers with regular spaces', () => {
    expect(formatPdfInteger(250_000)).toBe('250 000');
  });

  it('replaces em dash', () => {
    expect(sanitizePdfText('a — b')).toBe('a - b');
  });
});
