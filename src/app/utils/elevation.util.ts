import { Waypoint } from '../models/waypoint.model';
import { CircuitLeg } from '../models/circuit.model';
import { formatMetersDisplay } from './airspace-altitude.util';

/** Altitude MSL en mètres pour export / affichage tâche. */
export function resolveLegElevationM(
  wp: Waypoint | undefined,
  leg: CircuitLeg
): number | undefined {
  if (leg.elevationM != null && Number.isFinite(leg.elevationM)) {
    return Math.round(leg.elevationM);
  }
  if (wp?.elevation != null && Number.isFinite(wp.elevation)) {
    return Math.round(wp.elevation);
  }
  return undefined;
}

/** Format CUP `elev` (mètres avec suffixe m). */
export function formatCupElevation(elevationM: number | undefined): string {
  if (elevationM == null || !Number.isFinite(elevationM)) {
    return '';
  }
  return `${Math.round(elevationM)}m`;
}

/** Altitude pour balise XCSoar `<Waypoint altitude="...">` (MSL, m). */
export function formatTskAltitude(elevationM: number | undefined): number {
  if (elevationM == null || !Number.isFinite(elevationM)) {
    return 0;
  }
  return Math.round(elevationM);
}

export function formatElevationDisplay(elevationM: number | undefined): string {
  if (elevationM == null || !Number.isFinite(elevationM)) {
    return '—';
  }
  return `${formatMetersDisplay(elevationM)} MSL`;
}
