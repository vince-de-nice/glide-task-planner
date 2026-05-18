import { Waypoint } from './waypoint.model';

/** Rôle d'un point dans le circuit (ordre de la liste). */
export type CircuitLegRole = 'departure' | 'arrival' | 'turnpoint';

/** Seul un aérodrome peut être décollage (1er) ou atterrissage (dernier). */
export function canWaypointBeDeparture(wp: Waypoint | undefined): boolean {
  return wp?.type === 'airfield';
}

export function canWaypointBeArrival(wp: Waypoint | undefined): boolean {
  return wp?.type === 'airfield';
}

export interface CircuitLeg {
  waypointId: string;
  role: CircuitLegRole;
}

export function circuitRoleLabel(role: CircuitLegRole): string {
  switch (role) {
    case 'departure':
      return 'Décollage';
    case 'arrival':
      return 'Atterrissage';
    default:
      return 'Point de virage';
  }
}

export function circuitRoleShortLabel(role: CircuitLegRole): string {
  switch (role) {
    case 'departure':
      return 'Décollage';
    case 'arrival':
      return 'Atterrissage';
    default:
      return 'Virage';
  }
}

/** Suffixe carte : decollage, atterrissage ou numéro de position. */
export function circuitRoleMapToken(role: CircuitLegRole, position: number): string {
  switch (role) {
    case 'departure':
      return 'decollage';
    case 'arrival':
      return 'atterrissage';
    default:
      return String(position);
  }
}
