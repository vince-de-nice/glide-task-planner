import { describe, expect, it } from 'vitest';
import { sanitizePdfText } from './print-pdf-text.util';

describe('sanitizePdfText', () => {
  it('replaces Unicode arrows with ASCII', () => {
    expect(sanitizePdfText('A → B')).toBe('A -> B');
    expect(sanitizePdfText('A ↔ B')).toBe('A <-> B');
  });
});
