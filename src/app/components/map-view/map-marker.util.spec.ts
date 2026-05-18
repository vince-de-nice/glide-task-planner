import { describe, it, expect } from 'vitest';
import { buildMapMarkerHtml, formatMapRoleSuffix } from './map-marker.util';

describe('map-marker.util', () => {
  it('formats role suffix in lowercase', () => {
    expect(formatMapRoleSuffix(['Décollage', 'Atterrissage'])).toBe('(decollage, atterrissage)');
  });

  it('renders plain text label without box', () => {
    const html = buildMapMarkerHtml({
      name: 'Vinon',
      type: 'airfield',
      suffix: '(1,5)'
    });
    expect(html).toContain('Vinon (1,5)');
    expect(html).not.toContain('<svg');
    expect(html).not.toContain('text-shadow');
    expect(html).toContain('vav-map-label__text');
  });
});
