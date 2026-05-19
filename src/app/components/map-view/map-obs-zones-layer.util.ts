import {
  circle,
  Layer,
  LayerGroup,
  polygon,
  polyline
} from 'leaflet';
import {
  buildCircuitObsZoneShapes,
  faiKeyholePolygonLatLngs,
  ObsZoneMapShape,
  obsZoneMapColors,
  ringSectorPolygonLatLngs,
  sectorPolygonLatLngs
} from '../../utils/obs-zone-map.util';
import { CircuitLeg } from '../../models/circuit.model';
import { Waypoint } from '../../models/waypoint.model';

/** Dessine les formes de zones d'observation sur un groupe Leaflet. */
export function renderObsZoneShapes(
  layerGroup: LayerGroup,
  shapes: ObsZoneMapShape[]
): void {
  layerGroup.clearLayers();

  for (const shape of shapes) {
    const colors = obsZoneMapColors(shape.role);
    const style = {
      color: colors.stroke,
      weight: 2,
      opacity: 0.9,
      fillColor: colors.fill,
      fillOpacity: 0.14
    };

    const layer = shapeToLeafletLayer(shape, style);
    if (!layer) {
      continue;
    }

    layer.bindTooltip(`Pt ${shape.legIndex + 1} · ${shape.label}`, {
      sticky: true,
      opacity: 0.92
    });
    layer.addTo(layerGroup);
  }
}

export function buildObsZoneShapesForCircuit(
  legs: CircuitLeg[],
  waypointById: Map<string, Waypoint>,
  defaultRadiusM: number
): ObsZoneMapShape[] {
  return buildCircuitObsZoneShapes(legs, waypointById, defaultRadiusM);
}

function shapeToLeafletLayer(
  shape: ObsZoneMapShape,
  style: {
    color: string;
    weight: number;
    opacity: number;
    fillColor: string;
    fillOpacity: number;
  }
): Layer | null {
  if (shape.kind === 'line' && shape.linePoints?.length === 2) {
    return polyline(shape.linePoints, {
      ...style,
      weight: 4,
      fill: false,
      fillOpacity: 0
    });
  }

  if (
    shape.kind === 'fai-keyhole' &&
    shape.radiusM != null &&
    shape.innerRadiusM != null &&
    shape.startBearingDeg != null &&
    shape.endBearingDeg != null &&
    shape.innerStartBearingDeg != null &&
    shape.innerEndBearingDeg != null
  ) {
    const pts = faiKeyholePolygonLatLngs(
      shape.center,
      shape.radiusM,
      shape.innerRadiusM,
      shape.innerStartBearingDeg,
      shape.innerEndBearingDeg,
      shape.startBearingDeg,
      shape.endBearingDeg
    );
    return polygon(pts, style);
  }

  if (
    (shape.kind === 'sector' || shape.kind === 'ring-sector') &&
    shape.radiusM != null &&
    shape.startBearingDeg != null &&
    shape.endBearingDeg != null
  ) {
    const pts =
      shape.kind === 'ring-sector' && shape.innerRadiusM
        ? ringSectorPolygonLatLngs(
            shape.center,
            shape.radiusM,
            shape.innerRadiusM,
            shape.startBearingDeg,
            shape.endBearingDeg
          )
        : sectorPolygonLatLngs(
            shape.center,
            shape.radiusM,
            shape.startBearingDeg,
            shape.endBearingDeg
          );
    return polygon(pts, style);
  }

  if (shape.kind === 'circle' && shape.radiusM != null) {
    return circle(shape.center, {
      ...style,
      radius: shape.radiusM
    });
  }

  return null;
}
