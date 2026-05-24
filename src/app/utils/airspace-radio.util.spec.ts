import { describe, expect, it } from 'vitest';
import { formatPoaffMhzLines } from './airspace-radio.util';

describe('formatPoaffMhzLines', () => {
  it('formats numeric MHz frequencies', () => {
    expect(formatPoaffMhzLines({ TWR: ['124.0*'] })).toEqual(['TWR: 124.0 MHz']);
  });

  it('keeps telephone entries', () => {
    expect(formatPoaffMhzLines({ ATIS: ['TEL: 04 92 19 94 92'] })).toEqual([
      'ATIS: TEL: 04 92 19 94 92'
    ]);
  });

  it('passes through values that already contain MHz', () => {
    expect(
      formatPoaffMhzLines({ APP: ['135.150 MHz'] })
    ).toEqual(['APP: 135.150 MHz']);
  });
});
