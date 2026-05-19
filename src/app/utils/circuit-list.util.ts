import { CircuitLeg } from '../models/circuit.model';
import { CircuitListItem } from '../models/circuit-list-item.model';
import { Waypoint } from '../models/waypoint.model';
import { buildObsZonePreview } from './obs-zone-preview.util';

/** Construit les lignes affichées dans la liste du circuit (aperçu zone inclus). */
export function buildCircuitListItems(
  legs: CircuitLeg[],
  getWaypoint: (id: string) => Waypoint | undefined,
  defaultRadiusM: number
): CircuitListItem[] {
  const depLeg = legs.find(l => l.role === 'departure');
  const departureWp = depLeg
    ? (getWaypoint(depLeg.waypointId) ?? null)
    : null;

  return legs.flatMap((leg, index): CircuitListItem[] => {
    const wp = getWaypoint(leg.waypointId);
    if (!wp) return [];

    const prev =
      index > 0 ? (getWaypoint(legs[index - 1].waypointId) ?? null) : null;
    const next =
      index < legs.length - 1
        ? (getWaypoint(legs[index + 1].waypointId) ?? null)
        : null;

    const previewView = buildObsZonePreview({
      legIndex: index,
      leg,
      waypoint: wp,
      prev,
      next,
      departure: departureWp,
      defaultRadiusM
    });

    return [
      {
        leg,
        waypoint: wp,
        legIndex: index,
        previewView,
        key: `${index}-${leg.waypointId}-${leg.role}`
      }
    ];
  });
}
