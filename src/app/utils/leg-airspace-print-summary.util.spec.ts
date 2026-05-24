import { describe, expect, it } from 'vitest';
import {
  buildAirspacePrintSummarySections,
  undirectedLegSegmentKey
} from './leg-airspace-print-summary.util';
import type { CircuitLeg } from '../models/circuit.model';
import type { SafetyLegRender } from '../services/safety-profile-terrain.facade';

describe('undirectedLegSegmentKey', () => {
  it('is order-independent', () => {
    expect(undirectedLegSegmentKey('b', 'a')).toBe(undirectedLegSegmentKey('a', 'b'));
  });
});

describe('buildAirspacePrintSummarySections', () => {
  const wp = (id: string, name: string) =>
    ({ id, name, type: 'turnpoint' as const, lat: 0, lon: 0 });

  const leg = (
    index: number,
    from: ReturnType<typeof wp>,
    to: ReturnType<typeof wp>
  ): SafetyLegRender =>
    ({
      index,
      fromWaypoint: from,
      toWaypoint: to,
      fromEndpoint: { name: from.name, elevationM: 1000 },
      toEndpoint: { name: to.name, elevationM: 1000 },
      distanceKm: 10,
      envelope: { samples: [], landableCones: [], legStartKm: 0, legEndKm: 10 },
      landableToggles: []
    }) as SafetyLegRender;

  it('merges outbound and return into one section with deduped zones', () => {
    const a = wp('a', 'A');
    const b = wp('b', 'B');
    const circuitLegs: CircuitLeg[] = [
      {
        waypointId: 'a',
        role: 'departure',
        safetyOutgoing: {
          disabledLandableIds: [],
          airspaceZoneCatalog: [
            { key: 'z1', name: 'Zone 1', class: 'R' },
            { key: 'z2', name: 'Zone 2' }
          ]
        }
      },
      {
        waypointId: 'b',
        role: 'turnpoint',
        safetyOutgoing: {
          disabledLandableIds: [],
          airspaceZoneCatalog: [
            { key: 'z1', name: 'Zone 1', class: 'R' },
            { key: 'z3', name: 'Zone 3' }
          ]
        }
      },
      { waypointId: 'c', role: 'arrival' }
    ];

    const sections = buildAirspacePrintSummarySections({
      circuitLegs,
      legRenders: [leg(0, a, b), leg(1, b, a)],
      enabledAirspaceKeysForLeg: () => new Set(['z1', 'z2', 'z3'])
    });

    expect(sections).toHaveLength(1);
    expect(sections[0].bidirectional).toBe(true);
    expect(sections[0].title).toBe('A ↔ B');
    expect(sections[0].zones.map(z => z.key).sort()).toEqual(['z1', 'z2', 'z3']);
  });
});
