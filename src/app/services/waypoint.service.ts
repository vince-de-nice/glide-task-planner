import { Injectable, signal } from '@angular/core';
import { Waypoint } from '../models/waypoint.model';
import { CupParserService } from './cup-parser.service';

@Injectable({
  providedIn: 'root'
})
export class WaypointService {
  private readonly STORAGE_KEY = 'vav_waypoints';
  waypoints = signal<Waypoint[]>([]);

  constructor(private cupParser: CupParserService) {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    const storedWaypoints = localStorage.getItem(this.STORAGE_KEY);
    if (storedWaypoints) {
      this.waypoints.set(JSON.parse(storedWaypoints));
    }
  }

  private saveToStorage(): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.waypoints()));
  }

  addWaypoint(waypoint: Omit<Waypoint, 'id'>): Waypoint {
    const newWaypoint: Waypoint = {
      ...waypoint,
      id: this.generateId()
    };
    this.waypoints.update(current => [...current, newWaypoint]);
    this.saveToStorage();
    return newWaypoint;
  }

  updateWaypoint(id: string, updates: Partial<Waypoint>): void {
    this.waypoints.update(current =>
      current.map(wp => (wp.id === id ? { ...wp, ...updates } : wp))
    );
    this.saveToStorage();
  }

  deleteWaypoint(id: string): void {
    this.waypoints.update(current => current.filter(wp => wp.id !== id));
    this.saveToStorage();
  }

  getWaypoint(id: string): Waypoint | undefined {
    return this.waypoints().find(wp => wp.id === id);
  }

  importWaypointsFromJson(json: string, replace: boolean): void {
    const parsed = JSON.parse(json) as Waypoint[];
    if (!Array.isArray(parsed)) {
      throw new Error('Format JSON invalide');
    }
    if (replace) {
      this.waypoints.set(parsed);
    } else {
      this.waypoints.update(current => [...current, ...parsed]);
    }
    this.saveToStorage();
  }

  exportWaypoints(): string {
    return JSON.stringify(this.waypoints(), null, 2);
  }

  replaceWaypointsFromCup(content: string): number {
    const waypoints = this.cupParser.parseCupFile(content);
    this.waypoints.set(waypoints);
    this.saveToStorage();
    return waypoints.length;
  }

  loadFromCupFile(content: string): void {
    this.replaceWaypointsFromCup(content);
  }

  clearWaypoints(): void {
    this.waypoints.set([]);
    this.saveToStorage();
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}
