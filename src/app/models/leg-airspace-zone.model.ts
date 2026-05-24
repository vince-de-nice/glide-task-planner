/** Entrée persistée : zone POAFF retenue pour une branche (coupe). */
export interface LegAirspaceZoneCatalogEntry {
  /** Identifiant stable (GUId POAFF ou repli). */
  key: string;
  name: string;
  class?: string;
  type?: string;
  lower?: string;
  upper?: string;
  /** Texte réglementaire POAFF (abrégé à l’impression si long). */
  desc?: string;
  /** Lignes radio dérivées de `Mhz` (ex. `TWR: 124.0 MHz`). */
  radioLines?: string[];
  /** Activation / horaires (code + description courte). */
  activation?: string;
}
