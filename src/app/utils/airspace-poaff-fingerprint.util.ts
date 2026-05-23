import type { FeatureCollection, Geometry } from 'geojson';
import type { PoaffProperties } from '../services/airspace-layer.service';

/** Empreinte rapide du GeoJSON brut (détecte un remplacement de fichier même nom). */
export function poaffCollectionFingerprint(
  collection: FeatureCollection<Geometry, PoaffProperties>
): string {
  const n = collection.features.length;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const p = collection.features[i].properties;
    if (!p) continue;
    acc +=
      (p.id?.length ?? 0) +
      (p.GUId?.length ?? 0) +
      (p.lower?.length ?? 0) +
      (p.upper?.length ?? 0) +
      (p.lowerM ?? 0) +
      (p.upperM ?? 0);
  }
  return `${n}:${acc}`;
}
