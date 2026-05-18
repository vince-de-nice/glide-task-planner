import { Injectable } from '@angular/core';
import { Waypoint } from '../models/waypoint.model';

export type DistanceUnit = 'km' | 'nm' | 'mi';

export type LegExclusionReason = 'departure' | 'arrival';

export interface TaskLegDistance {
  legIndex: number;
  fromIndex: number;
  toIndex: number;
  distance: number;
  counted: boolean;
  exclusionReason?: LegExclusionReason;
}

export interface DistanceResult {
  /** Distance de la tâche (segments comptés, hors branches déco/attero). */
  taskDistance: number;
  /** Distance sur tout le tracé du circuit. */
  totalDistance: number;
  legDistances: TaskLegDistance[];
  unit: DistanceUnit;
}

@Injectable({
  providedIn: 'root'
})
export class DistanceService {
  private readonly EARTH_RADIUS_KM = 6371;
  private readonly EARTH_RADIUS_NM = 3440.065;
  private readonly EARTH_RADIUS_MI = 3958.8;

  /**
   * Distance du circuit en km, sans les branches reliées au décollage (1er pt aérodrome)
   * ni à l'atterrissage (dernier pt aérodrome).
   */
  calculateTaskDistance(
    waypoints: Waypoint[],
    unit: DistanceUnit = 'km'
  ): DistanceResult {
    if (waypoints.length < 2) {
      return { taskDistance: 0, totalDistance: 0, legDistances: [], unit };
    }

    const radius = this.getRadius(unit);
    const hasDeparture = waypoints[0].type === 'airfield';
    const hasArrival = waypoints[waypoints.length - 1].type === 'airfield';

    const legDistances: TaskLegDistance[] = [];
    let taskDistance = 0;
    let totalDistance = 0;

    for (let i = 0; i < waypoints.length - 1; i++) {
      const distance = this.haversine(
        waypoints[i].latitude,
        waypoints[i].longitude,
        waypoints[i + 1].latitude,
        waypoints[i + 1].longitude,
        radius
      );

      const exclusionReason = this.getLegExclusionReason(
        i,
        waypoints.length,
        hasDeparture,
        hasArrival
      );
      const counted = exclusionReason === undefined;

      legDistances.push({
        legIndex: i,
        fromIndex: i,
        toIndex: i + 1,
        distance,
        counted,
        exclusionReason
      });

      totalDistance += distance;
      if (counted) {
        taskDistance += distance;
      }
    }

    return { taskDistance, totalDistance, legDistances, unit };
  }

  /** @deprecated Préférer calculateTaskDistance — conserve la compatibilité (distance totale). */
  calculateDistance(waypoints: Waypoint[], unit: DistanceUnit = 'km'): DistanceResult {
    const result = this.calculateTaskDistance(waypoints, unit);
    return {
      ...result,
      taskDistance: result.totalDistance
    };
  }

  calculateBearing(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const toDeg = (rad: number) => (rad * 180) / Math.PI;

    const dLon = toRad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(toRad(lat2));
    const x =
      Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
      Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);

    const bearing = toDeg(Math.atan2(y, x));
    return (bearing + 360) % 360;
  }

  private getLegExclusionReason(
    legIndex: number,
    waypointCount: number,
    hasDeparture: boolean,
    hasArrival: boolean
  ): LegExclusionReason | undefined {
    if (hasDeparture && legIndex === 0) {
      return 'departure';
    }
    if (hasArrival && legIndex === waypointCount - 2) {
      return 'arrival';
    }
    return undefined;
  }

  private haversine(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
    radius: number
  ): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return radius * c;
  }

  private getRadius(unit: DistanceUnit): number {
    switch (unit) {
      case 'nm':
        return this.EARTH_RADIUS_NM;
      case 'mi':
        return this.EARTH_RADIUS_MI;
      default:
        return this.EARTH_RADIUS_KM;
    }
  }
}
