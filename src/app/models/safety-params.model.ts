/**
 * Paramètres de calcul du profil de sécurité d'un circuit.
 *
 * - `glideRatio` : finesse du planeur (1 m d'altitude = N m de distance « planable »).
 * - `arrivalMarginM` : altitude requise au-dessus du terrain posable (« tour de piste »).
 * - `groundMarginM` : marge verticale minimale au-dessus du relief (cols, crêtes).
 * - `airspaceProfileMarginM` : marge au-dessus de l'altitude mini pour borner l'affichage
 *   des espaces aériens sur la coupe (évite les plafonds réglementaires très hauts).
 */
export interface SafetyParams {
  glideRatio: number;
  arrivalMarginM: number;
  groundMarginM: number;
  airspaceProfileMarginM: number;
}

export const DEFAULT_SAFETY_PARAMS: SafetyParams = {
  glideRatio: 35,
  arrivalMarginM: 250,
  groundMarginM: 100,
  airspaceProfileMarginM: 400
};

/** Bornes UI raisonnables (input validation). */
export const SAFETY_PARAMS_BOUNDS = {
  glideRatio: { min: 5, max: 80 },
  arrivalMarginM: { min: 0, max: 1500 },
  groundMarginM: { min: 0, max: 1500 },
  airspaceProfileMarginM: { min: 0, max: 2000 }
} as const;

export function sanitizeSafetyParams(
  patch: Partial<SafetyParams>,
  fallback: SafetyParams = DEFAULT_SAFETY_PARAMS
): SafetyParams {
  const next: SafetyParams = { ...fallback };
  if (Number.isFinite(patch.glideRatio)) {
    next.glideRatio = clamp(
      patch.glideRatio!,
      SAFETY_PARAMS_BOUNDS.glideRatio.min,
      SAFETY_PARAMS_BOUNDS.glideRatio.max
    );
  }
  if (Number.isFinite(patch.arrivalMarginM)) {
    next.arrivalMarginM = clamp(
      patch.arrivalMarginM!,
      SAFETY_PARAMS_BOUNDS.arrivalMarginM.min,
      SAFETY_PARAMS_BOUNDS.arrivalMarginM.max
    );
  }
  if (Number.isFinite(patch.groundMarginM)) {
    next.groundMarginM = clamp(
      patch.groundMarginM!,
      SAFETY_PARAMS_BOUNDS.groundMarginM.min,
      SAFETY_PARAMS_BOUNDS.groundMarginM.max
    );
  }
  if (Number.isFinite(patch.airspaceProfileMarginM)) {
    next.airspaceProfileMarginM = clamp(
      patch.airspaceProfileMarginM!,
      SAFETY_PARAMS_BOUNDS.airspaceProfileMarginM.min,
      SAFETY_PARAMS_BOUNDS.airspaceProfileMarginM.max
    );
  }
  return next;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
