import { Injectable } from '@angular/core';
import { Waypoint } from '../models/waypoint.model';

export interface DistanceResult {
  totalDistance: number;
  legDistances: number[];
  unit: 'km' | 'nm' | 'mi';
}

@Injectable({
  providedIn: 'root'
})
export class DistanceService {
  private readonly EARTH_RADIUS_KM = 6371;
  private readonly EARTH_RADIUS_NM = 3440.065;
  private readonly EARTH_RADIUS_MI = 3958.8;

  calculateDistance(waypoints: Waypoint[], unit: 'km' | 'nm' | 'mi' = 'km'): DistanceResult {
    if (waypoints.length < 2) {
      return { totalDistance: 0, legDistances: [], unit };
    }

    const radius = this.getRadius(unit);
    const legDistances: number[] = [];

    for (let i = 0; i < waypoints.length - 1; i++) {
      const distance = this.haversine(
        waypoints[i].latitude,
        waypoints[i].longitude,
        waypoints[i + 1].latitude,
        waypoints[i + 1].longitude,
        radius
      );
      legDistances.push(distance);
    }

    const totalDistance = legDistances.reduce((sum, dist) => sum + dist, 0);

    return {
      totalDistance,
      legDistances,
      unit
    };
  }

  calculateBearing(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const toRad = (deg: number) => deg * Math.PI / 180;
    const toDeg = (rad: number) => rad * 180 / Math.PI;

    const dLon = toRad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(toRad(lat2));
    const x =
      Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
      Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);

    const bearing = toDeg(Math.atan2(y, x));
    return (bearing + 360) % 360;
  }

  private haversine(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
    radius: number
  ): number {
    const toRad = (deg: number) => deg * Math.PI / 180;

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

  private getRadius(unit: 'km' | 'nm' | 'mi'): number {
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
