import { Injectable, inject } from '@angular/core';
import { Waypoint } from '../models/waypoint.model';
import { CupDatabaseService } from './cup-database.service';

/** Façade sur la base CUP unique ([`CupDatabaseService`]). */
@Injectable({
  providedIn: 'root'
})
export class WaypointService {
  private cupDatabase = inject(CupDatabaseService);

  waypoints = this.cupDatabase.waypoints;

  addWaypoint(waypoint: Omit<Waypoint, 'id'>): Waypoint {
    return this.cupDatabase.addWaypoint(waypoint);
  }

  updateWaypoint(id: string, updates: Partial<Waypoint>): void {
    this.cupDatabase.updateWaypoint(id, updates);
  }

  deleteWaypoint(id: string): void {
    this.cupDatabase.deleteWaypoint(id);
  }

  getWaypoint(id: string): Waypoint | undefined {
    return this.cupDatabase.getWaypoint(id);
  }

  replaceWaypointsFromCup(content: string): number {
    return this.cupDatabase.applyCupFile(content, 'Import CUP');
  }

  loadFromCupFile(content: string): void {
    this.cupDatabase.applyCupFile(content, 'Import CUP');
  }

  clearWaypoints(): void {
    this.cupDatabase.clearWaypoints();
  }
}
