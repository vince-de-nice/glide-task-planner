import { Injectable } from '@angular/core';
import type { SafetyParams } from '../models/safety-params.model';
import type { Waypoint } from '../models/waypoint.model';
import type { TerrainSample } from './terrain-profile.service';

/** Point d'une courbe de cône (altitude requise à une distance le long de la branche). */
export interface LandableConeSample {
  distanceKm: number;
  altitudeM: number;
}

/** Cône de finesse d'un terrain posable projeté sur la coupe de la branche. */
export interface LandableConeVisual {
  id: string;
  name: string;
  shortName: string;
  type: 'airfield' | 'landable';
  /** Position du terrain projetée sur l'axe de la branche (km depuis le départ ; peut être < 0 ou > longueur branche). */
  alongLegKm: number;
  /** Distance perpendiculaire à la branche (km). */
  crossTrackKm: number;
  /** Altitude waypoint (m MSL). */
  elevationM: number;
  /** Sommet du cône : terrain + hauteur tour de piste. */
  baseAltitudeM: number;
  /** Altitude requise en chaque échantillon pour rejoindre ce terrain en demi-finesse. */
  curve: LandableConeSample[];
  /** Ce terrain impose l'enveloppe à au moins un point (cône le plus contraignant). */
  isBinding: boolean;
}

/** Échantillon enrichi avec les altitudes de sécurité calculées. */
export interface EnvelopeSample {
  distanceKm: number;
  longitude: number;
  latitude: number;
  terrainM: number | null;
  groundClearanceM: number | null;
  glideConeM: number | null;
  safetyM: number | null;
  closestLandableId: string | null;
  closestLandableDistanceKm: number | null;
}

export interface LegEnvelope {
  samples: EnvelopeSample[];
  landableCones: LandableConeVisual[];
  noLandables: boolean;
  hasTerrainGaps: boolean;
  /** Début de la coupe (km depuis le départ de la branche ; peut être négatif). */
  profileStartKm: number;
  /** Fin de la coupe (km ; peut dépasser la longueur de la branche). */
  profileEndKm: number;
  /** Bornes réelles de la branche sur l'axe (km). */
  legStartKm: number;
  legEndKm: number;
}

export interface LegGeoEndpoints {
  fromLng: number;
  fromLat: number;
  toLng: number;
  toLat: number;
}

/** Altitudes tour de piste aux extrémités (m MSL) pour le test d'intersection. */
export interface LegEndpointAltitudes {
  fromElevationM: number | null;
  toElevationM: number | null;
}

/** Plage de distance à échantillonner le long de la branche (grand cercle prolongé). */
export interface LegProfileExtent {
  startKm: number;
  endKm: number;
}

const EARTH_RADIUS_KM = 6371;
const EXTENT_PADDING_KM = 0.5;
const MAX_CONES_DISPLAYED = 64;

@Injectable({ providedIn: 'root' })
export class GlideEnvelopeService {
  /**
   * Détermine l'étendue horizontale de la coupe : [0, longueur branche] élargie
   * jusqu'aux bases des cônes qui interceptent la branche.
   */
  computeProfileExtent(
    legLengthKm: number,
    landables: Waypoint[],
    params: SafetyParams,
    leg: LegGeoEndpoints,
    endpoints: LegEndpointAltitudes,
    terrainSamples: TerrainSample[]
  ): LegProfileExtent {
    const withElevation = landables.filter(
      la => la.elevation != null && Number.isFinite(la.elevation)
    );
    if (withElevation.length === 0) {
      return { startKm: 0, endKm: legLengthKm };
    }

    const halfRatio = halfGlideRatio(params);
    const refAltM = maxReferenceAltitudeM(
      params,
      endpoints,
      terrainSamples
    );
    const from: [number, number] = [leg.fromLng, leg.fromLat];
    const to: [number, number] = [leg.toLng, leg.toLat];

    let startKm = 0;
    let endKm = legLengthKm;

    for (const la of withElevation) {
      if (
        !coneIntersectsLegSegment(
          from,
          to,
          legLengthKm,
          la,
          params,
          refAltM,
          halfRatio
        )
      ) {
        continue;
      }
      const proj = projectOntoLeg(from, to, la.longitude, la.latitude, legLengthKm);
      startKm = Math.min(startKm, proj.alongKm);
      endKm = Math.max(endKm, proj.alongKm);
    }

    return {
      startKm: startKm - EXTENT_PADDING_KM,
      endKm: endKm + EXTENT_PADDING_KM
    };
  }

  /** Terrains posables dont le cône intercepte la branche (pour la liste de bascules). */
  filterIntersectingLandables(
    landables: Waypoint[],
    params: SafetyParams,
    leg: LegGeoEndpoints,
    endpoints: LegEndpointAltitudes,
    legLengthKm: number,
    terrainSamples: TerrainSample[]
  ): Waypoint[] {
    const withElevation = landables.filter(
      la => la.elevation != null && Number.isFinite(la.elevation)
    );
    if (withElevation.length === 0) return [];

    const halfRatio = halfGlideRatio(params);
    const refAltM = maxReferenceAltitudeM(params, endpoints, terrainSamples);
    const from: [number, number] = [leg.fromLng, leg.fromLat];
    const to: [number, number] = [leg.toLng, leg.toLat];

    return withElevation
      .filter(la =>
        coneIntersectsLegSegment(
          from,
          to,
          legLengthKm,
          la,
          params,
          refAltM,
          halfRatio
        )
      )
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }

  computeLegEnvelope(
    samples: TerrainSample[],
    landables: Waypoint[],
    params: SafetyParams,
    leg: LegGeoEndpoints,
    endpoints: LegEndpointAltitudes,
    legLengthKm: number
  ): LegEnvelope {
    const noLandables = landables.length === 0;
    const halfRatio = halfGlideRatio(params);
    const profileStartKm =
      samples.length > 0 ? samples[0].distanceKm : 0;
    const profileEndKm =
      samples.length > 0 ? samples[samples.length - 1].distanceKm : legLengthKm;

    const withElevation = landables.filter(
      la => la.elevation != null && Number.isFinite(la.elevation)
    );

    const refAltM = maxReferenceAltitudeM(params, endpoints, samples);
    const from: [number, number] = [leg.fromLng, leg.fromLat];
    const to: [number, number] = [leg.toLng, leg.toLat];

    const intersecting = noLandables
      ? []
      : withElevation.filter(la =>
          coneIntersectsLegSegment(from, to, legLengthKm, la, params, refAltM, halfRatio)
        );

    const landableCones = intersecting.length === 0
      ? []
      : this.buildLandableCones(
          samples,
          intersecting,
          params,
          leg,
          legLengthKm,
          halfRatio
        );

    const result: EnvelopeSample[] = samples.map(sample => {
      const terrainM = sample.elevationM;
      const groundClearanceM =
        terrainM != null ? terrainM + params.groundMarginM : null;

      let glideConeM: number | null = null;
      let closestLandableId: string | null = null;
      let closestLandableDistanceKm: number | null = null;

      if (intersecting.length > 0) {
        let bestAlt = Number.POSITIVE_INFINITY;
        let bestId: string | null = null;
        let bestDist = Number.POSITIVE_INFINITY;

        for (const la of intersecting) {
          const distKm = haversineKm(
            sample.longitude,
            sample.latitude,
            la.longitude,
            la.latitude
          );
          const altRequired = coneAltitudeAtDistanceM(
            la.elevation!,
            params.arrivalMarginM,
            distKm,
            halfRatio
          );
          if (altRequired < bestAlt) {
            bestAlt = altRequired;
            bestId = la.id;
            bestDist = distKm;
          }
        }

        if (bestId != null && Number.isFinite(bestAlt)) {
          glideConeM = bestAlt;
          closestLandableId = bestId;
          closestLandableDistanceKm = bestDist;
        }
      }

      let safetyM: number | null;
      if (glideConeM != null && groundClearanceM != null) {
        safetyM = Math.max(glideConeM, groundClearanceM);
      } else if (glideConeM != null) {
        safetyM = glideConeM;
      } else if (groundClearanceM != null) {
        safetyM = groundClearanceM;
      } else {
        safetyM = null;
      }

      return {
        distanceKm: sample.distanceKm,
        longitude: sample.longitude,
        latitude: sample.latitude,
        terrainM,
        groundClearanceM,
        glideConeM,
        safetyM,
        closestLandableId,
        closestLandableDistanceKm
      };
    });

    return {
      samples: result,
      landableCones,
      noLandables: noLandables && intersecting.length === 0,
      hasTerrainGaps: samples.some(s => s.elevationM === null),
      profileStartKm,
      profileEndKm,
      legStartKm: 0,
      legEndKm: legLengthKm
    };
  }

  private buildLandableCones(
    samples: TerrainSample[],
    landables: Waypoint[],
    params: SafetyParams,
    leg: LegGeoEndpoints,
    legLengthKm: number,
    halfRatio: number
  ): LandableConeVisual[] {
    if (samples.length === 0 || landables.length === 0) return [];

    const from: [number, number] = [leg.fromLng, leg.fromLat];
    const to: [number, number] = [leg.toLng, leg.toLat];

    const bindingIds = new Set<string>();
    for (const sample of samples) {
      let bestId: string | null = null;
      let bestAlt = Number.POSITIVE_INFINITY;
      for (const la of landables) {
        const d = haversineKm(
          sample.longitude,
          sample.latitude,
          la.longitude,
          la.latitude
        );
        const alt = coneAltitudeAtDistanceM(
          la.elevation!,
          params.arrivalMarginM,
          d,
          halfRatio
        );
        if (alt < bestAlt) {
          bestAlt = alt;
          bestId = la.id;
        }
      }
      if (bestId) bindingIds.add(bestId);
    }

    const candidates: LandableConeVisual[] = [];

    for (const la of landables) {
      const elev = la.elevation!;
      const proj = projectOntoLeg(
        from,
        to,
        la.longitude,
        la.latitude,
        legLengthKm
      );
      const baseAltitudeM = elev + params.arrivalMarginM;

      const curve: LandableConeSample[] = samples.map(sample => {
        const distKm = haversineKm(
          sample.longitude,
          sample.latitude,
          la.longitude,
          la.latitude
        );
        return {
          distanceKm: sample.distanceKm,
          altitudeM: coneAltitudeAtDistanceM(
            elev,
            params.arrivalMarginM,
            distKm,
            halfRatio
          )
        };
      });

      candidates.push({
        id: la.id,
        name: la.name,
        shortName: truncateName(la.name, la.code),
        type: la.type === 'airfield' ? 'airfield' : 'landable',
        alongLegKm: proj.alongKm,
        crossTrackKm: proj.crossTrackKm,
        elevationM: elev,
        baseAltitudeM,
        curve,
        isBinding: bindingIds.has(la.id)
      });
    }

    candidates.sort((a, b) => {
      if (a.isBinding !== b.isBinding) return a.isBinding ? -1 : 1;
      return a.crossTrackKm - b.crossTrackKm;
    });

    return candidates.slice(0, MAX_CONES_DISPLAYED);
  }
}

/** Demi-finesse utilisée pour la pente du cône (L/D ÷ 2). */
function halfGlideRatio(params: SafetyParams): number {
  return Math.max(1, params.glideRatio / 2);
}

/**
 * Altitude minimale (m MSL) pour rejoindre le terrain posable depuis une distance horizontale donnée.
 * Sommet du cône = elev + marge tour de piste ; pente = demi-finesse.
 */
function coneAltitudeAtDistanceM(
  elevationM: number,
  arrivalMarginM: number,
  horizontalDistKm: number,
  halfRatio: number
): number {
  return elevationM + arrivalMarginM + (horizontalDistKm * 1000) / halfRatio;
}

/**
 * Le cône (sommet au terrain + tour de piste, pente demi-finesse) intercepte le segment de branche
 * si la distance horizontale minimale au segment est inférieure à la portée horizontale
 * depuis l'altitude de référence maximale le long de la branche.
 */
function coneIntersectsLegSegment(
  from: [number, number],
  to: [number, number],
  legLengthKm: number,
  landable: Waypoint,
  params: SafetyParams,
  refAltM: number,
  halfRatio: number
): boolean {
  const elev = landable.elevation;
  if (elev == null || !Number.isFinite(elev)) return false;

  const base = elev + params.arrivalMarginM;
  if (refAltM <= base) return false;

  const reachKm = ((refAltM - base) * halfRatio) / 1000;
  const proj = projectOntoLeg(
    from,
    to,
    landable.longitude,
    landable.latitude,
    legLengthKm
  );

  if (proj.crossTrackKm <= reachKm) return true;

  const distStartKm = haversineKm(from[0], from[1], landable.longitude, landable.latitude);
  const distEndKm = haversineKm(to[0], to[1], landable.longitude, landable.latitude);
  return distStartKm <= reachKm || distEndKm <= reachKm;
}

function maxReferenceAltitudeM(
  params: SafetyParams,
  endpoints: LegEndpointAltitudes,
  samples: TerrainSample[]
): number {
  let ref = 0;
  if (endpoints.fromElevationM != null) {
    ref = Math.max(ref, endpoints.fromElevationM + params.arrivalMarginM);
  }
  if (endpoints.toElevationM != null) {
    ref = Math.max(ref, endpoints.toElevationM + params.arrivalMarginM);
  }
  for (const s of samples) {
    if (s.elevationM != null) {
      ref = Math.max(ref, s.elevationM + params.groundMarginM);
    }
  }
  return ref;
}

function truncateName(name: string, code?: string): string {
  if (code?.trim()) return code.trim().slice(0, 8);
  return name.length > 10 ? `${name.slice(0, 9)}…` : name;
}

/** Projection sur le grand cercle prolongé ; alongKm peut être hors [0, legLengthKm]. */
function projectOntoLeg(
  from: [number, number],
  to: [number, number],
  lng: number,
  lat: number,
  legLengthKm: number
): { alongKm: number; crossTrackKm: number } {
  let bestT = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  const steps = 120;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 - 0.5;
    const [pLng, pLat] = interpolateGreatCircle(from, to, t);
    const d = haversineKm(pLng, pLat, lng, lat);
    if (d < bestDist) {
      bestDist = d;
      bestT = t;
    }
  }
  return {
    alongKm: bestT * legLengthKm,
    crossTrackKm: bestDist
  };
}

function interpolateGreatCircle(
  from: [number, number],
  to: [number, number],
  t: number
): [number, number] {
  const [lon1, lat1] = from.map(toRad) as [number, number];
  const [lon2, lat2] = to.map(toRad) as [number, number];

  const x1 = Math.cos(lat1) * Math.cos(lon1);
  const y1 = Math.cos(lat1) * Math.sin(lon1);
  const z1 = Math.sin(lat1);
  const x2 = Math.cos(lat2) * Math.cos(lon2);
  const y2 = Math.cos(lat2) * Math.sin(lon2);
  const z2 = Math.sin(lat2);

  const dot = clamp(x1 * x2 + y1 * y2 + z1 * z2, -1, 1);
  const omega = Math.acos(dot);
  const sinOmega = Math.sin(omega);

  let xi: number;
  let yi: number;
  let zi: number;
  if (sinOmega < 1e-9) {
    xi = x1 + (x2 - x1) * t;
    yi = y1 + (y2 - y1) * t;
    zi = z1 + (z2 - z1) * t;
  } else {
    const a = Math.sin((1 - t) * omega) / sinOmega;
    const b = Math.sin(t * omega) / sinOmega;
    xi = a * x1 + b * x2;
    yi = a * y1 + b * y2;
    zi = a * z1 + b * z2;
  }
  const lat = Math.atan2(zi, Math.sqrt(xi * xi + yi * yi));
  const lon = Math.atan2(yi, xi);
  return [toDeg(lon), toDeg(lat)];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function haversineKm(
  lng1: number,
  lat1: number,
  lng2: number,
  lat2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lng2 - lng1);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_KM * c;
}
