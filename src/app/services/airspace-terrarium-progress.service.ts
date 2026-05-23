import { computed, Injectable, signal } from '@angular/core';

export interface AirspaceTerrariumProgressState {
  regionLabel: string;
  totalZones: number;
  processedZones: number;
  loadedTiles: number;
  totalTiles: number;
  percent: number;
  phase: 'prepare' | 'tiles' | 'enrich' | 'done';
}

@Injectable({ providedIn: 'root' })
export class AirspaceTerrariumProgressService {
  private readonly state = signal<AirspaceTerrariumProgressState | null>(null);

  readonly active = computed(() => this.state() != null && this.state()!.phase !== 'done');
  readonly percent = computed(() => this.state()?.percent ?? 0);
  readonly label = computed(() => {
    const s = this.state();
    if (!s) return '';
    if (s.phase === 'prepare') {
      return `${s.regionLabel} · préparation ${s.totalZones} zones DEM`;
    }
    if (s.phase === 'tiles') {
      return `${s.regionLabel} · DEM ${s.loadedTiles}/${s.totalTiles} tuiles · ${s.totalZones} zones AGL/GND`;
    }
    if (s.phase === 'enrich') {
      return `${s.regionLabel} · enrichissement ${s.processedZones}/${s.totalZones}`;
    }
    return s.regionLabel;
  });

  /** Libellé court pour la pastille sur la carte. */
  readonly compactLabel = computed(() => {
    const s = this.state();
    if (!s) return '';
    if (s.phase === 'tiles' && s.totalTiles > 0) {
      return `Espaces aériens · ${s.percent}% · tuiles ${s.loadedTiles}/${s.totalTiles}`;
    }
    if (s.totalZones > 0) {
      return `Espaces aériens · ${s.percent}% · ${s.processedZones}/${s.totalZones} zones DEM`;
    }
    return `Espaces aériens · ${s.percent}%`;
  });

  readonly snapshot = computed(() => this.state());

  begin(regionLabel: string, totalZones: number): void {
    this.state.set({
      regionLabel,
      totalZones,
      processedZones: 0,
      loadedTiles: 0,
      totalTiles: 0,
      percent: 0,
      phase: 'prepare'
    });
  }

  setPreparePercent(percent: number): void {
    this.patch({ phase: 'prepare', percent: clampPercent(percent) });
  }

  setTileProgress(loadedTiles: number, totalTiles: number): void {
    const tiles = Math.max(1, totalTiles);
    const pct = Math.round((loadedTiles / tiles) * 92);
    this.patch({
      phase: 'tiles',
      loadedTiles,
      totalTiles: tiles,
      percent: clampPercent(pct)
    });
  }

  setEnrichProgress(processedZones: number, totalZones: number): void {
    const zones = Math.max(1, totalZones);
    const pct = 92 + Math.round((processedZones / zones) * 8);
    this.patch({
      phase: 'enrich',
      processedZones,
      totalZones: zones,
      percent: clampPercent(pct)
    });
  }

  complete(): void {
    this.patch({ phase: 'done', percent: 100 });
    this.state.set(null);
  }

  cancel(): void {
    this.state.set(null);
  }

  private patch(partial: Partial<AirspaceTerrariumProgressState>): void {
    this.state.update(current => {
      if (!current) return current;
      return { ...current, ...partial };
    });
  }
}

function clampPercent(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}
