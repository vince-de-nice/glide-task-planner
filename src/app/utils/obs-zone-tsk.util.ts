import { ObservationZoneConfig } from '../models/observation-zone.model';
import { CircuitLegRole } from '../models/circuit.model';

export interface TskObservationZoneXml {
  type: string;
  attrs: Record<string, string | number>;
}

/**
 * Mappe une zone CUP vers une balise XCSoar ObservationZone.
 * @see https://aerofiles.readthedocs.io/en/latest/api/xcsoar.html
 */
export function mapObservationZoneToTsk(
  zone: ObservationZoneConfig,
  legRole: CircuitLegRole
): TskObservationZoneXml {
  if (zone.line) {
    const length = zone.a1Deg === 180 ? zone.r1M * 2 : zone.r1M;
    return {
      type: 'Line',
      attrs: { length: Math.round(length) }
    };
  }

  if (zone.r2M != null && zone.r2M > 0 && zone.a1Deg != null) {
    const end = zone.a1Deg;
    return {
      type: 'Sector',
      attrs: {
        radius: zone.r1M,
        start_radial: 0,
        end_radial: end
      }
    };
  }

  if (zone.cupStyle === 1) {
    return {
      type: 'SymmetricQuadrant',
      attrs: { radius: zone.r1M }
    };
  }

  if (zone.cupStyle === 2 && legRole === 'turnpoint' && zone.a1Deg != null) {
    return {
      type: 'Sector',
      attrs: {
        radius: zone.r1M,
        start_radial: 0,
        end_radial: zone.a1Deg
      }
    };
  }

  return {
    type: 'Cylinder',
    attrs: { radius: zone.r1M }
  };
}

export function formatTskObservationZoneTag(zone: TskObservationZoneXml): string {
  const attrs = Object.entries(zone.attrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');
  return `\t\t<ObservationZone type="${zone.type}" ${attrs}/>`;
}
