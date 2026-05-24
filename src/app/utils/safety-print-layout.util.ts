import type {
  SafetyPrintLayoutMode,
  SafetyPrintProfilePlacement
} from '../models/safety-print-options.model';
import type { SafetyLegRender } from '../services/safety-profile-terrain.facade';
import type { Waypoint } from '../models/waypoint.model';
import {
  buildPrintPageLayout,
  type PrintPageSpec
} from './print-scale.util';
import {
  boundsFromCircuit,
  boundsFromLegRender
} from './safety-profile-map-render.util';

export interface PrintJobMapPage {
  kind: 'map';
  pageSpec: PrintPageSpec;
  focusLegIndex: number | null;
}

export interface PrintJobProfilePage {
  kind: 'profile';
  legIndex: number;
  /** Si défini, carte sur la même feuille au-dessus de la coupe. */
  mapPageSpec: PrintPageSpec | null;
}

/** Toutes les coupes profil sur une seule page paysage. */
export interface PrintJobProfilesCombinedPage {
  kind: 'profilesCombined';
  legIndices: number[];
}

export type PrintJobPage =
  | PrintJobMapPage
  | PrintJobProfilePage
  | PrintJobProfilesCombinedPage;

/** Nombre d'étapes de rendu (carte, coupe, mise en page, sauvegarde). */
export function countPrintWorkSteps(pages: PrintJobPage[]): number {
  let steps = 1;
  for (const page of pages) {
    if (page.kind === 'map') {
      steps += 2;
    } else if (page.kind === 'profilesCombined') {
      steps += page.legIndices.length * 2 + 1;
    } else if (page.kind === 'profile') {
      steps += 2;
      if (page.mapPageSpec) steps += 1;
    }
  }
  return steps;
}

export function buildPrintJobPages(params: {
  layoutMode: SafetyPrintLayoutMode;
  legRenders: SafetyLegRender[];
  legPairs: { from: Waypoint; to: Waypoint }[];
  includeHeader: boolean;
  includeProfileChart: boolean;
  profileChartPlacement: SafetyPrintProfilePlacement;
  cones3d: boolean;
  getWaypoint: (id: string) => Waypoint | undefined;
}): PrintJobPage[] {
  if (params.layoutMode === 'fullCircuit') {
    const bounds = boundsFromCircuit(params.legPairs);
    const specs = buildPrintPageLayout({
      bounds,
      includeHeader: params.includeHeader,
      boundsPaddingFraction: 0.05
    });
    return specs.map(pageSpec => ({
      kind: 'map' as const,
      pageSpec,
      focusLegIndex: null
    }));
  }

  const pages: PrintJobPage[] = [];
  const allProfilesOnOnePage =
    params.includeProfileChart &&
    params.profileChartPlacement === 'allOnOnePage';

  for (const leg of params.legRenders) {
    const bounds = boundsFromLegRender(
      leg,
      params.cones3d,
      params.getWaypoint
    );
    const mapSpecs = buildPrintPageLayout({
      bounds,
      includeHeader: params.includeHeader,
      boundsPaddingFraction: 0.08
    });

    const profileOnMap =
      params.includeProfileChart && params.profileChartPlacement === 'withMap';

    if (profileOnMap) {
      for (const pageSpec of mapSpecs) {
        pages.push({
          kind: 'profile',
          legIndex: leg.index,
          mapPageSpec: pageSpec
        });
      }
      if (mapSpecs.length === 0) {
        pages.push({
          kind: 'profile',
          legIndex: leg.index,
          mapPageSpec: null
        });
      }
    } else {
      for (const pageSpec of mapSpecs) {
        pages.push({
          kind: 'map',
          pageSpec,
          focusLegIndex: leg.index
        });
      }
      if (params.includeProfileChart && !allProfilesOnOnePage) {
        pages.push({
          kind: 'profile',
          legIndex: leg.index,
          mapPageSpec: null
        });
      }
    }
  }

  if (allProfilesOnOnePage && params.legRenders.length > 0) {
    pages.push({
      kind: 'profilesCombined',
      legIndices: params.legRenders.map(l => l.index)
    });
  }

  return pages;
}
