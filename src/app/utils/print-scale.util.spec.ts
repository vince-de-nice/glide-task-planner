import { describe, expect, it } from 'vitest';
import {
  buildPrintPageLayout,
  clampProfileChartHeightPercent,
  groundSpanMetersPerPage,
  orientationForBounds,
  pickScaleBarMeters,
  PRINT_SCALE_DENOMINATOR,
  profileChartExportPixelSize,
  zoomForFixedScale
} from './print-scale.util';

describe('print-scale.util', () => {
  it('computes zoom for 1:250000 near mid-latitude', () => {
    const z = zoomForFixedScale(45);
    expect(z).toBeGreaterThan(10);
    expect(z).toBeLessThan(14);
  });

  it('picks landscape for wide bbox', () => {
    const o = orientationForBounds({
      minLng: 5,
      minLat: 44,
      maxLng: 6.2,
      maxLat: 44.3
    });
    expect(o).toBe('landscape');
  });

  it('tiles large circuit into multiple pages', () => {
    const pages = buildPrintPageLayout({
      bounds: {
        minLng: 5,
        minLat: 44,
        maxLng: 6.5,
        maxLat: 45.2
      },
      boundsPaddingFraction: 0
    });
    expect(pages.length).toBeGreaterThan(1);
    expect(pages[0].zoom).toBe(zoomForFixedScale(44.6));
    expect(pages[0].totalPages).toBe(pages.length);
  });

  it('single page for small bbox', () => {
    const pages = buildPrintPageLayout({
      bounds: {
        minLng: 5.1,
        minLat: 44.1,
        maxLng: 5.15,
        maxLat: 44.12
      },
      boundsPaddingFraction: 0.05
    });
    expect(pages).toHaveLength(1);
  });

  it('ground span matches scale on A4 landscape', () => {
    const { widthM } = groundSpanMetersPerPage('landscape', 45, true);
    expect(widthM).toBeCloseTo(((297 - 16) / 1000) * PRINT_SCALE_DENOMINATOR, -2);
  });

  it('picks a round scale bar length', () => {
    expect(pickScaleBarMeters(50_000)).toBe(5_000);
  });

  it('clamps profile chart height percent', () => {
    expect(clampProfileChartHeightPercent(30)).toBe(30);
    expect(clampProfileChartHeightPercent(5)).toBe(10);
    expect(clampProfileChartHeightPercent(80)).toBe(60);
  });

  it('derives export pixels from height percent when combined with map', () => {
    const full = profileChartExportPixelSize({
      layout: 'withMap',
      includeHeader: true,
      heightPercent: 60
    });
    const small = profileChartExportPixelSize({
      layout: 'withMap',
      includeHeader: true,
      heightPercent: 30
    });
    expect(small.height).toBeLessThan(full.height);
    expect(small.width).toBe(full.width);
  });

  it('uses full printable area in landscape for profile-only pages', () => {
    const profileOnly = profileChartExportPixelSize({
      layout: 'profileOnly',
      includeHeader: true
    });
    const withMap = profileChartExportPixelSize({
      layout: 'withMap',
      includeHeader: true,
      heightPercent: 30
    });
    expect(profileOnly.width).toBeGreaterThan(withMap.width);
    expect(profileOnly.height).toBeGreaterThan(withMap.height);
  });

  it('splits height between profiles on a combined page', () => {
    const one = profileChartExportPixelSize({
      layout: 'profilesCombined',
      includeHeader: true,
      combinedProfileCount: 1
    });
    const three = profileChartExportPixelSize({
      layout: 'profilesCombined',
      includeHeader: true,
      combinedProfileCount: 3
    });
    expect(three.height).toBeLessThan(one.height);
    expect(three.width).toBe(one.width);
  });
});
