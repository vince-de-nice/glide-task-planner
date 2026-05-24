import { describe, expect, it } from 'vitest';
import { countPrintWorkSteps, type PrintJobPage } from './safety-print-layout.util';

describe('countPrintWorkSteps', () => {
  it('counts map render, layout and save for a map-only page', () => {
    const pages: PrintJobPage[] = [
      {
        kind: 'map',
        focusLegIndex: null,
        pageSpec: {
          pageIndex: 0,
          totalPages: 1,
          orientation: 'portrait',
          center: [5, 44],
          zoom: 10,
          groundWidthM: 1000,
          groundHeightM: 1000
        }
      }
    ];
    expect(countPrintWorkSteps(pages)).toBe(3);
  });

  it('adds an extra step when a branch page includes map and profile', () => {
    const pages: PrintJobPage[] = [
      {
        kind: 'profile',
        legIndex: 0,
        mapPageSpec: {
          pageIndex: 0,
          totalPages: 1,
          orientation: 'portrait',
          center: [5, 44],
          zoom: 10,
          groundWidthM: 1000,
          groundHeightM: 1000
        }
      }
    ];
    expect(countPrintWorkSteps(pages)).toBe(4);
  });
});
