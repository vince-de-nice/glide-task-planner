import type { SafetyPrintLayoutMode } from '../models/safety-print-options.model';
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

export type PrintJobPage = PrintJobMapPage | PrintJobProfilePage;

/** Nombre d'étapes de rendu (carte, coupe, mise en page, sauvegarde). */
export function countPrintWorkSteps(pages: PrintJobPage[]): number {
  let steps = 1;
  for (const page of pages) {
    if (page.kind === 'map') {
      steps += 2;
    } else {
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

    if (params.includeProfileChart && mapSpecs.length === 1) {
      pages.push({
        kind: 'profile',
        legIndex: leg.index,
        mapPageSpec: mapSpecs[0]
      });
    } else {
      for (const pageSpec of mapSpecs) {
        pages.push({
          kind: 'map',
          pageSpec,
          focusLegIndex: leg.index
        });
      }
      if (params.includeProfileChart) {
        pages.push({
          kind: 'profile',
          legIndex: leg.index,
          mapPageSpec: null
        });
      }
    }
  }
  return pages;
}
