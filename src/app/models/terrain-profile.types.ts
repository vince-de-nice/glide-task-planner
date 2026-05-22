/** Origine de l'altitude terrain affichée sur la coupe. */
export type TerrainElevationQuality = 'dem' | 'dem-low' | 'estimated' | 'missing';

/** Point d'échantillonnage le long d'une branche, altitudes en m MSL. */
export interface TerrainSample {
  distanceKm: number;
  longitude: number;
  latitude: number;
  elevationM: number | null;
  elevationQuality?: TerrainElevationQuality;
  /** Transitoire après fetch tuile (avant annotation qualité). */
  demSampleQuality?: 'dem' | 'dem-low';
}

export interface LegProfile {
  fromLngLat: [number, number];
  toLngLat: [number, number];
  samples: TerrainSample[];
  totalDistanceKm: number;
  sampleCount: number;
  /** Vrai si au moins un échantillon est resté null (tuile manquante). */
  hasGaps: boolean;
}
