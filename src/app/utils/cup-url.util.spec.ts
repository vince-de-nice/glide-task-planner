import { describe, it, expect } from 'vitest';
import { isAllowedCupFetchUrl } from './cup-url.util';

describe('cup-url.util', () => {
  it('allows relative asset paths', () => {
    expect(isAllowedCupFetchUrl('/assets/cup/default.cup')).toBe(true);
  });

  it('allows https URLs', () => {
    expect(isAllowedCupFetchUrl('https://example.com/base.cup')).toBe(true);
  });

  it('rejects javascript and file schemes', () => {
    expect(isAllowedCupFetchUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedCupFetchUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects protocol-relative URLs', () => {
    expect(isAllowedCupFetchUrl('//evil.com/x.cup')).toBe(false);
  });
});
