import { Injectable, inject } from '@angular/core';
import { CupCatalog, CupCatalogEntry } from '../models/cup-catalog.model';
import { WaypointService } from './waypoint.service';
import { TaskStateService } from './task-state.service';

@Injectable({
  providedIn: 'root'
})
export class CupLoaderService {
  private waypointService = inject(WaypointService);
  private taskState = inject(TaskStateService);

  private catalogCache: CupCatalog | null = null;

  async loadCatalog(): Promise<CupCatalog> {
    if (this.catalogCache) {
      return this.catalogCache;
    }
    const response = await fetch('/assets/cup/cup-catalog.json');
    if (!response.ok) {
      throw new Error('Impossible de charger le catalogue CUP');
    }
    this.catalogCache = (await response.json()) as CupCatalog;
    return this.catalogCache;
  }

  async loadEmbedded(entry: CupCatalogEntry, clearTask: boolean): Promise<number> {
    const response = await fetch(`/assets/cup/${entry.filename}`);
    if (!response.ok) {
      throw new Error(`Fichier introuvable : ${entry.filename}`);
    }
    const content = await response.text();
    return this.applyCupContent(content, entry.id, clearTask);
  }

  async loadFromFile(file: File, clearTask: boolean): Promise<number> {
    const content = await file.text();
    return this.applyCupContent(content, null, clearTask);
  }

  private applyCupContent(
    content: string,
    databaseId: string | null,
    clearTask: boolean
  ): number {
    const count = this.waypointService.replaceWaypointsFromCup(content);
    this.taskState.setActiveDatabaseId(databaseId);
    if (clearTask) {
      this.taskState.clearSelection();
      this.taskState.resetTaskNameToToday();
    }
    return count;
  }
}
