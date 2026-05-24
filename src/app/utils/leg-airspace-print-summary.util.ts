import type { CircuitLeg } from '../models/circuit.model';
import type { LegAirspaceZoneCatalogEntry } from '../models/leg-airspace-zone.model';
import type { SafetyLegRender } from '../services/safety-profile-terrain.facade';

export interface AirspacePrintSummarySection {
  segmentKey: string;
  /** Ex. « Annecy ↔ Chamonix » ou « Annecy → Chamonix ». */
  title: string;
  /** Branches aller et/ou retour regroupées. */
  legIndices: number[];
  bidirectional: boolean;
  zones: LegAirspaceZoneCatalogEntry[];
}

export function undirectedLegSegmentKey(fromId: string, toId: string): string {
  return fromId < toId ? `${fromId}|${toId}` : `${toId}|${fromId}`;
}

export function buildAirspacePrintSummarySections(params: {
  circuitLegs: CircuitLeg[];
  legRenders: SafetyLegRender[];
  enabledAirspaceKeysForLeg: (legIndex: number) => Set<string>;
}): AirspacePrintSummarySection[] {
  type Acc = {
    fromId: string;
    toId: string;
    fromName: string;
    toName: string;
    legIndices: number[];
    hasForward: boolean;
    hasReverse: boolean;
  };

  const bySegment = new Map<string, Acc>();

  for (const leg of params.legRenders) {
    const fromId = leg.fromWaypoint.id;
    const toId = leg.toWaypoint.id;
    const key = undirectedLegSegmentKey(fromId, toId);
    let acc = bySegment.get(key);
    if (!acc) {
      acc = {
        fromId,
        toId,
        fromName: leg.fromWaypoint.name,
        toName: leg.toWaypoint.name,
        legIndices: [],
        hasForward: false,
        hasReverse: false
      };
      bySegment.set(key, acc);
    }
    acc.legIndices.push(leg.index);
    if (fromId === acc.fromId && toId === acc.toId) {
      acc.hasForward = true;
    } else {
      acc.hasReverse = true;
    }
  }

  const sections: AirspacePrintSummarySection[] = [];

  for (const [segmentKey, acc] of bySegment) {
    const bidirectional = acc.hasForward && acc.hasReverse;
    const title = bidirectional
      ? `${acc.fromName} ↔ ${acc.toName}`
      : acc.hasReverse
        ? `${acc.toName} → ${acc.fromName}`
        : `${acc.fromName} → ${acc.toName}`;

    const zones = mergeEnabledZonesForLegs({
      legIndices: [...acc.legIndices].sort((a, b) => a - b),
      circuitLegs: params.circuitLegs,
      enabledAirspaceKeysForLeg: params.enabledAirspaceKeysForLeg
    });

    sections.push({
      segmentKey,
      title,
      legIndices: [...acc.legIndices].sort((a, b) => a - b),
      bidirectional,
      zones
    });
  }

  sections.sort((a, b) => a.legIndices[0] - b.legIndices[0]);
  return sections;
}

function mergeEnabledZonesForLegs(params: {
  legIndices: number[];
  circuitLegs: CircuitLeg[];
  enabledAirspaceKeysForLeg: (legIndex: number) => Set<string>;
}): LegAirspaceZoneCatalogEntry[] {
  const byKey = new Map<string, LegAirspaceZoneCatalogEntry>();

  for (const legIdx of params.legIndices) {
    const enabled = params.enabledAirspaceKeysForLeg(legIdx);
    const catalog =
      params.circuitLegs[legIdx]?.safetyOutgoing?.airspaceZoneCatalog ?? [];
    for (const z of catalog) {
      if (!enabled.has(z.key)) continue;
      if (!byKey.has(z.key)) byKey.set(z.key, z);
    }
  }

  return [...byKey.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })
  );
}
