import { Waypoint } from './waypoint.model';
import { ObservationZoneConfig } from './observation-zone.model';

/** Rôle d'un point dans le circuit (ordre de la liste). */
export type CircuitLegRole = 'departure' | 'arrival' | 'turnpoint';

/** Seul un aérodrome peut être décollage (1er) ou atterrissage (dernier). */
export function canWaypointBeDeparture(wp: Waypoint | undefined): boolean {
  return wp?.type === 'airfield';
}

export function canWaypointBeArrival(wp: Waypoint | undefined): boolean {
  return wp?.type === 'airfield';
}

/** Profil de sécurité sur la branche sortante de ce point (vers le point suivant). */
export interface SafetyOutgoingBranch {
  /** Terrains posables exclus du calcul et de l'affichage sur cette branche. */
  disabledLandableIds: string[];
}

export interface CircuitLeg {
  waypointId: string;
  role: CircuitLegRole;
  /** Zone d’observation pour export CUP / XCSoar (défaut selon le rôle). */
  obsZone?: ObservationZoneConfig;
  /** Altitude MSL (m) pour la tâche ; sinon altitude du waypoint CUP. */
  elevationM?: number;
  /** Réglages profil sécurité pour la branche vers le point suivant (absent sur le dernier point). */
  safetyOutgoing?: SafetyOutgoingBranch;
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
