import { MercatorCoordinate } from 'maplibre-gl';
import { projectMercatorToCanvasPoint } from './map-3d-projection.util';

export interface Map3dLabelSpec {
  key: string;
  longitude: number;
  latitude: number;
  altitudeM: number;
  label: string;
  color: string;
}

export interface Map3dLabelScreenPosition {
  key: string;
  x: number;
  y: number;
  label: string;
  color: string;
}

/** Projette des libellés 3D (MSL) vers des coordonnées CSS du canvas carte. */
export function projectMap3dLabelsToScreen(
  specs: readonly Map3dLabelSpec[],
  mainMatrix: ArrayLike<number>,
  canvas: HTMLCanvasElement
): Map3dLabelScreenPosition[] {
  if (specs.length === 0) return [];

  const rect = canvas.getBoundingClientRect();
  const scaleX = rect.width > 0 ? rect.width / canvas.width : 1;
  const scaleY = rect.height > 0 ? rect.height / canvas.height : 1;
  const positions: Map3dLabelScreenPosition[] = [];

  for (const spec of specs) {
    const mc = MercatorCoordinate.fromLngLat(
      [spec.longitude, spec.latitude],
      spec.altitudeM
    );
    const screen = projectMercatorToCanvasPoint(
      mainMatrix,
      mc.x,
      mc.y,
      mc.z,
      canvas.width,
      canvas.height
    );
    if (!screen.visible) continue;
    positions.push({
      key: spec.key,
      x: screen.x * scaleX,
      y: screen.y * scaleY,
      label: spec.label,
      color: spec.color
    });
  }

  return positions;
}
