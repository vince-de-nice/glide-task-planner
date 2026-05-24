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

  it('derives export pixels from height percent', () => {
    const full = profileChartExportPixelSize({
      includeHeader: true,
      heightPercent: 60
    });
    const small = profileChartExportPixelSize({
      includeHeader: true,
      heightPercent: 30
    });
    expect(small.height).toBeLessThan(full.height);
    expect(small.width).toBe(full.width);
  });
});
