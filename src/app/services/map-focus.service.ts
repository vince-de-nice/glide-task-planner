import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class MapFocusService {
  readonly focusedWaypointId = signal<string | null>(null);
  readonly focusedLegIndex = signal<number | null>(null);

  setFocus(waypointId: string, legIndex?: number): void {
    this.focusedWaypointId.set(waypointId);
    this.focusedLegIndex.set(legIndex ?? null);
  }

  clearFocus(): void {
    this.focusedWaypointId.set(null);
    this.focusedLegIndex.set(null);
  }
}
