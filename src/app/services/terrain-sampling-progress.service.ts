import { Injectable, computed, signal } from '@angular/core';

export type TerrainSamplingPhase = 'idle' | 'dem' | 'compute';

export interface TerrainSamplingProgressState {
  phase: TerrainSamplingPhase;
  legIndex: number;
  legCount: number;
  chunkIndex: number;
  chunkCount: number;
  percent: number;
  legLabel: string | null;
}

@Injectable({ providedIn: 'root' })
export class TerrainSamplingProgressService {
  readonly state = signal<TerrainSamplingProgressState | null>(null);

  readonly active = computed(() => {
    const s = this.state();
    return s != null && s.phase !== 'idle';
  });

  readonly percent = computed(() => this.state()?.percent ?? 0);

  begin(legCount: number): void {
    this.state.set({
      phase: 'dem',
      legIndex: 0,
      legCount: Math.max(1, legCount),
      chunkIndex: 0,
      chunkCount: 1,
      percent: 0,
      legLabel: null
    });
  }

  setDemChunk(
    legIndex: number,
    legCount: number,
    chunkIndex: number,
    chunkCount: number,
    legLabel: string | null = null
  ): void {
    const legs = Math.max(1, legCount);
    const chunks = Math.max(1, chunkCount);
    const legFrac = (legIndex + (chunkIndex + 1) / chunks) / legs;
    this.state.set({
      phase: 'dem',
      legIndex,
      legCount: legs,
      chunkIndex,
      chunkCount: chunks,
      percent: Math.min(100, Math.round(legFrac * 100)),
      legLabel
    });
  }

  setComputeLeg(
    legIndex: number,
    legCount: number,
    legLabel: string | null = null
  ): void {
    const legs = Math.max(1, legCount);
    const legFrac = (legIndex + 1) / legs;
    this.state.set({
      phase: 'compute',
      legIndex,
      legCount: legs,
      chunkIndex: 0,
      chunkCount: 1,
      percent: Math.min(100, Math.round(legFrac * 100)),
      legLabel
    });
  }

  end(): void {
    this.state.set(null);
  }
}

export interface TerrainSamplingProgressContext {
  legIndex: number;
  legCount: number;
  legLabel?: string;
}
