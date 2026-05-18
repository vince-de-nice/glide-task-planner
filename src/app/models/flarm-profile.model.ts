/** Métadonnées IGC / FLARM (FTD-014 §3.1.10–3.1.16) */
export interface FlarmProfile {
  pilotName: string;
  gliderType: string;
  gliderId: string;
  compId: string;
  compClass: string;
  /** Intervalle d'enregistrement GPS en secondes (1–8, défaut planeur : 4) */
  logInterval: number;
}

export interface FlarmDeclaration extends FlarmProfile {
  taskName: string;
}

export const DEFAULT_FLARM_PROFILE: FlarmProfile = {
  pilotName: '',
  gliderType: '',
  gliderId: '',
  compId: '',
  compClass: '',
  logInterval: 4
};
