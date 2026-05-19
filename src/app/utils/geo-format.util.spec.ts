import { describe, it, expect } from 'vitest';
import {
  formatIgcLatitude,
  formatIgcLongitude,
  formatSeeYouLatitude,
  isValidLatitude
} from './geo-format.util';

describe('geo-format.util', () => {
  it('formats IGC Lasham takeoff example', () => {
    const lat = 51 + 11.359 / 60;
    const lon = -(1 + 1.899 / 60);
    expect(formatIgcLatitude(lat)).toBe('51 11 359N');
    expect(formatIgcLongitude(lon)).toBe('001 01 899W');
  });

  it('formats SeeYou latitude', () => {
    expect(formatSeeYouLatitude(43.7361)).toMatch(/^4344\.\d{3}N$/);
  });

  it('validates latitude', () => {
    expect(isValidLatitude(45)).toBe(true);
    expect(isValidLatitude(91)).toBe(false);
  });
});
