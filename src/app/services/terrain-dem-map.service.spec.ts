import {
  DEM_SAMPLE_ZOOM,
  demChunkMaxSpanKm,
  splitSegmentIntoChunks
} from './terrain-dem-map.service';

describe('DEM z15 coverage', () => {
  it('uses zoom 15 everywhere', () => {
    expect(DEM_SAMPLE_ZOOM).toBe(15);
  });

  it('computes a sub-3 km chunk span at mid-latitude', () => {
    const km = demChunkMaxSpanKm(46);
    expect(km).toBeGreaterThan(1.5);
    expect(km).toBeLessThan(3.5);
  });

  it('splits a long leg into enough z15 windows', () => {
    const segment = {
      from: [6.8, 46.2] as [number, number],
      to: [7.5, 46.8] as [number, number]
    };
    const chunkKm = demChunkMaxSpanKm(46.5);
    const chunks = splitSegmentIntoChunks(segment, chunkKm);
    expect(chunks.length).toBeGreaterThanOrEqual(15);
  });

  it('keeps sub-kilometre legs as a single chunk', () => {
    const segment = {
      from: [6.85, 46.5] as [number, number],
      to: [6.851, 46.501] as [number, number]
    };
    const chunks = splitSegmentIntoChunks(segment, demChunkMaxSpanKm(46.5));
    expect(chunks.length).toBe(1);
  });
});
