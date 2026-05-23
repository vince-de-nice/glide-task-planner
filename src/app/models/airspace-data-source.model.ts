/** Métadonnées d’une source GeoJSON importée (le fichier est en IndexedDB). */
export interface CustomAirspaceSourceMeta {
  id: string;
  label: string;
  importedAt: string;
  featureCount: number;
}

export interface BuiltinAirspaceSourceMeta {
  id: string;
  label: string;
  kind: 'poaff';
}
