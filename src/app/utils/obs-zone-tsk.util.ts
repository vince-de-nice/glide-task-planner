import { ObservationZoneConfig } from '../models/observation-zone.model';
import { CircuitLegRole } from '../models/circuit.model';

export interface TskObservationZoneXml {
  type: string;
  attrs: Record<string, string | number>;
}

/**
 * Mappe une zone CUP vers une balise XCSoar ObservationZone.
 *
 * Corrections vs. ancienne version :
 * - Line : length = 2 × R1 (R1 = demi-largeur per CUP spec, cf. XCSoar #2029).
 * - Secteur annulaire / keyhole (R2 + A1) → CustomKeyhole (radius, inner_radius, angle).
 * - Secteur simple (A1 sans R2) → Sector avec radiales absolues calculées depuis
 *   referenceBearingDeg (axe de la zone vers le point suivant/précédent/fixe).
 * - Style 1 (symétrique) → SymmetricQuadrant.
 * - Fallback → Cylinder.
 *
 * @param zone            Zone CUP normalisée.
 * @param legRole         Rôle du point (departure / turnpoint / arrival).
 * @param referenceBearingDeg  Cap de référence absolu (°, nord = 0) pour orienter
 *                        les secteurs dans le repère TSK.  Absent → secteur symétrique
 *                        centré sur le Nord (0°) — approximation à documenter.
 *
 * @see https://aerofiles.readthedocs.io/en/latest/api/xcsoar.html
 * @see https://github.com/XCSoar/XCSoar/issues/2029  (R1 = half gate width)
 * @see https://github.com/naviter/seeyou_file_formats/blob/main/CUP_file_format.md
 */
export function mapObservationZoneToTsk(
  zone: ObservationZoneConfig,
  legRole: CircuitLegRole,
  referenceBearingDeg?: number
): TskObservationZoneXml {
  // — Ligne (Line=1) ——————————————————————————————————————————————
  // R1 = demi-largeur dans la spec CUP → longueur totale = 2 × R1.
  if (zone.line) {
    return {
      type: 'Line',
      attrs: { length: Math.round(zone.r1M * 2) }
    };
  }

  // — Cylindre symétrique (Style 1) ————————————————————————————————
  if (zone.cupStyle === 1) {
    return {
      type: 'SymmetricQuadrant',
      attrs: { radius: zone.r1M }
    };
  }

  // — Keyhole / secteur annulaire (R1 + R2 + A1) ———————————————————
  // CustomKeyhole = secteur externe (angle = A1, rayon = R1) + disque interne (R2).
  // Utilisé pour sector_fai / keyhole FAI et tout secteur avec rayon intérieur.
  if (zone.r2M != null && zone.r2M > 0 && zone.a1Deg != null && zone.a1Deg > 0) {
    return {
      type: 'CustomKeyhole',
      attrs: {
        radius: zone.r1M,
        inner_radius: zone.r2M,
        angle: zone.a1Deg
      }
    };
  }

  // — Secteur simple (A1 défini, pas de rayon intérieur) ————————————
  // Les radiales absolues sont calculées depuis l'axe de référence.
  // Sans axe fourni, on centre sur 0° (Nord) — valable uniquement si l'utilisateur
  // ajuste ensuite dans XCSoar, ou si la zone est explicitement orientée vers le Nord.
  if (zone.a1Deg != null && zone.a1Deg > 0 && zone.a1Deg < 360) {
    const half = zone.a1Deg / 2;
    const center = referenceBearingDeg ?? 0;
    const startRadial = Math.round(((center - half) % 360 + 360) % 360);
    const endRadial = Math.round(((center + half) % 360 + 360) % 360);
    return {
      type: 'Sector',
      attrs: {
        radius: zone.r1M,
        start_radial: startRadial,
        end_radial: endRadial
      }
    };
  }

  // — Cylindre (Style 0 / 2 / 3 / 4 sans secteur ni ligne) ————————
  return {
    type: 'Cylinder',
    attrs: { radius: zone.r1M }
  };
}

export function formatTskObservationZoneTag(zone: TskObservationZoneXml): string {
  const attrs = Object.entries(zone.attrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');
  return `\t\t<ObservationZone type="${zone.type}" ${attrs}/>`;
}
