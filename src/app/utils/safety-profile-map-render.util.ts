import type { FeatureCollection, LineString } from 'geojson';
import type { Waypoint } from '../models/waypoint.model';
import type { SafetyLegRender } from '../services/safety-profile-terrain.facade';
import { buildProfileLegPointsGeoJson } from './safety-cone-map-geojson.util';
import {
  buildSafetyMinAltitudeCrossingLabelSpecs,
  collectActiveConeCrossings
} from './safety-cone-crossings.util';
import {
  buildSafetyMinAltitudeTerrainMarginMapLabelSpecs,
  buildSafetyMinAltitudeTerrainMarginSections
} from './safety-min-altitude-style.util';
import { buildSafetyMinAltitudePath } from './safety-min-altitude-three-layer.util';
import {
  buildSafetyConeMeshSpecs,
  type SafetyConeMeshSpec
} from './safety-cone-three-layer.util';
import { buildConeRingLabelSpecs } from './safety-cone-ring-labels.util';
import { landableColorFromId } from './safety-profile-palette.util';
import type { Map3dLabelSpec } from './map-3d-labels.util';
import { collectLegMapFitPoints } from './safety-profile-map-fit.util';
import type { GeoBounds } from './print-scale.util';

export function buildBranchLinesGeoJson(
  pairs: { from: Waypoint; to: Waypoint }[],
  selectedLegIndex: number | null
): FeatureCollection<LineString> {
  return {
    type: 'FeatureCollection',
    features: pairs.map((p, idx) => ({
      type: 'Feature' as const,
      properties: {
        legIndex: idx,
        selected: selectedLegIndex != null && idx === selectedLegIndex
      },
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [p.from.longitude, p.from.latitude],
          [p.to.longitude, p.to.latitude]
        ]
      }
    }))
  };
}

export function buildLegPointsGeoJsonForRender(
  leg: SafetyLegRender,
  getWaypoint: (id: string) => Waypoint | undefined
): FeatureCollection {
  const landables = leg.landableToggles
    .filter(t => t.enabled)
    .flatMap(t => {
      const wp = getWaypoint(t.id);
      if (!wp) return [];
      return [
        {
          id: t.id,
          role: 'landable' as const,
          longitude: wp.longitude,
          latitude: wp.latitude,
          label: t.shortName,
          color: t.color
        }
      ];
    });

  return buildProfileLegPointsGeoJson({
    from: {
      longitude: leg.fromWaypoint.longitude,
      latitude: leg.fromWaypoint.latitude,
      name: leg.fromWaypoint.name
    },
    to: {
      longitude: leg.toWaypoint.longitude,
      latitude: leg.toWaypoint.latitude,
      name: leg.toWaypoint.name
    },
    landables
  });
}

export function buildConeSpecsForLeg(
  leg: SafetyLegRender,
  glideRatio: number,
  getWaypoint: (id: string) => Waypoint | undefined
): SafetyConeMeshSpec[] {
  const enabledIds = new Set(
    leg.landableToggles.filter(t => t.enabled).map(t => t.id)
  );
  const enabledCones = leg.envelope.landableCones.filter(c => enabledIds.has(c.id));
  const apexMap = new Map<string, [number, number]>();
  for (const cone of enabledCones) {
    const wp = getWaypoint(cone.id);
    if (wp) apexMap.set(cone.id, [wp.longitude, wp.latitude]);
  }
  const halfRatio = Math.max(1, glideRatio / 2);
  const colorById = new Map(leg.landableToggles.map(t => [t.id, t.color] as const));
  return buildSafetyConeMeshSpecs({
    landableCones: enabledCones,
    halfRatio,
    landableApexLngLat: apexMap,
    colorById
  });
}

export function buildMap3dLabelSpecsForLeg(
  leg: SafetyLegRender,
  coneSpecs: readonly SafetyConeMeshSpec[],
  showRingLabels: boolean,
  showCrossingLabels: boolean
): Map3dLabelSpec[] {
  const specs: Map3dLabelSpec[] = [];
  if (showRingLabels && coneSpecs.length > 0) {
    specs.push(...buildConeRingLabelSpecs(coneSpecs));
  }
  if (showCrossingLabels) {
    const colorById = new Map(leg.landableToggles.map(t => [t.id, t.color] as const));
    const hits = collectActiveConeCrossings(
      leg.envelope.landableCones,
      leg.envelope.samples,
      id => colorById.get(id) ?? landableColorFromId(id)
    );
    specs.push(
      ...buildSafetyMinAltitudeCrossingLabelSpecs(hits, leg.envelope.samples)
    );
    specs.push(
      ...buildSafetyMinAltitudeTerrainMarginMapLabelSpecs(
        buildSafetyMinAltitudeTerrainMarginSections(leg.envelope.samples)
      )
    );
  }
  return specs;
}

export function boundsFromLegRender(
  leg: SafetyLegRender,
  cones3d: boolean,
  getWaypoint: (id: string) => Waypoint | undefined
): GeoBounds {
  const enabledIds = new Set(
    leg.landableToggles.filter(t => t.enabled).map(t => t.id)
  );
  const enabledLandables = leg.landableToggles
    .filter(t => t.enabled)
    .flatMap(t => {
      const wp = getWaypoint(t.id);
      return wp ? [wp] : [];
    });
  const { lngs, lats } = collectLegMapFitPoints({
    from: leg.fromWaypoint,
    to: leg.toWaypoint,
    samples: leg.envelope.samples,
    cones3d,
    enabledLandables,
    landableCones: leg.envelope.landableCones,
    enabledLandableIds: enabledIds
  });
  return {
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats)
  };
}

export function boundsFromCircuit(pairs: { from: Waypoint; to: Waypoint }[]): GeoBounds {
  const lngs: number[] = [];
  const lats: number[] = [];
  for (const p of pairs) {
    lngs.push(p.from.longitude, p.to.longitude);
    lats.push(p.from.latitude, p.to.latitude);
  }
  return {
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats)
  };
}

export { buildSafetyMinAltitudePath };
