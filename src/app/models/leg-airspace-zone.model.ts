/** Entrée persistée : zone POAFF retenue pour une branche (coupe). */
export interface LegAirspaceZoneCatalogEntry {
  /** Identifiant stable (GUId POAFF ou repli). */
  key: string;
  name: string;
  class?: string;
  type?: string;
  lower?: string;
  upper?: string;
}
