import { describe, expect, it, vi } from 'vitest';
import {
  buildPrintJobPages,
  countPrintWorkSteps,
  type PrintJobPage
} from './safety-print-layout.util';
import type { SafetyLegRender } from '../services/safety-profile-terrain.facade';
import type { PrintPageSpec } from './print-scale.util';

const twoMapTiles: PrintPageSpec[] = [
  {
    pageIndex: 0,
    totalPages: 2,
    orientation: 'portrait',
    center: [5, 44],
    zoom: 10,
    groundWidthM: 1000,
    groundHeightM: 1000
  },
  {
    pageIndex: 1,
    totalPages: 2,
    orientation: 'portrait',
    center: [5.1, 44.1],
    zoom: 10,
    groundWidthM: 1000,
    groundHeightM: 1000
  }
];

vi.mock('./print-scale.util', async importOriginal => {
  const actual = await importOriginal<typeof import('./print-scale.util')>();
  return {
    ...actual,
    buildPrintPageLayout: vi.fn(() => twoMapTiles)
  };
});

vi.mock('./safety-profile-map-render.util', () => ({
  boundsFromCircuit: vi.fn(),
  boundsFromLegRender: vi.fn(() => ({
    minLng: 5,
    maxLng: 5.5,
    minLat: 44,
    maxLat: 44.5
  }))
}));

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

describe('buildPrintJobPages profileChartPlacement', () => {
  const leg = { index: 0 } as SafetyLegRender;
  const legPairs = [
    {
      from: { id: 'a', name: 'A', latitude: 44, longitude: 5 } as never,
      to: { id: 'b', name: 'B', latitude: 44.5, longitude: 5.5 } as never
    }
  ];

  it('uses combined map+profile pages when placement is withMap', () => {
    const pages = buildPrintJobPages({
      layoutMode: 'perBranch',
      legRenders: [leg],
      legPairs,
      includeHeader: true,
      includeProfileChart: true,
      profileChartPlacement: 'withMap',
      cones3d: false,
      getWaypoint: () => undefined
    });
    expect(pages).toHaveLength(2);
    expect(pages.every(p => p.kind === 'profile' && p.mapPageSpec != null)).toBe(true);
  });

  it('uses separate profile page when placement is separatePage', () => {
    const pages = buildPrintJobPages({
      layoutMode: 'perBranch',
      legRenders: [leg],
      legPairs,
      includeHeader: true,
      includeProfileChart: true,
      profileChartPlacement: 'separatePage',
      cones3d: false,
      getWaypoint: () => undefined
    });
    const mapPages = pages.filter(p => p.kind === 'map');
    const profilePages = pages.filter(p => p.kind === 'profile');
    expect(mapPages).toHaveLength(2);
    expect(profilePages).toHaveLength(1);
    expect(profilePages[0].mapPageSpec).toBeNull();
  });

  it('adds one combined profile page when placement is allOnOnePage', () => {
    const leg2 = { index: 1 } as SafetyLegRender;
    const pages = buildPrintJobPages({
      layoutMode: 'perBranch',
      legRenders: [leg, leg2],
      legPairs: [
        legPairs[0],
        {
          from: { id: 'b', name: 'B', latitude: 44.5, longitude: 5.5 } as never,
          to: { id: 'c', name: 'C', latitude: 45, longitude: 6 } as never
        }
      ],
      includeHeader: true,
      includeProfileChart: true,
      profileChartPlacement: 'allOnOnePage',
      cones3d: false,
      getWaypoint: () => undefined
    });
    const combined = pages.filter(p => p.kind === 'profilesCombined');
    const profilePages = pages.filter(p => p.kind === 'profile');
    expect(profilePages).toHaveLength(0);
    expect(combined).toHaveLength(1);
    expect(combined[0].kind === 'profilesCombined' && combined[0].legIndices).toEqual([
      0, 1
    ]);
  });
});
