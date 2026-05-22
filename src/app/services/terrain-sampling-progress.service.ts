import { Injectable, computed, signal } from '@angular/core';

export type LegSamplingPhase = 'pending' | 'dem' | 'compute' | 'done';

export interface LegSamplingProgress {
  phase: LegSamplingPhase;
  /** 0–100, toujours croissant pour une branche donnée. */
  percent: number;
}

export interface TerrainSamplingProgressState {
  legs: LegSamplingProgress[];
}

/** Part du % réservée au téléchargement / cache terrain. */
const DEM_MAX_PERCENT = 75;
/** % pendant le calcul d'enveloppe (après terrain). */
const COMPUTE_PERCENT = 90;

@Injectable({ providedIn: 'root' })
export class TerrainSamplingProgressService {
  readonly state = signal<TerrainSamplingProgressState | null>(null);

  readonly active = computed(() => {
    const legs = this.state()?.legs;
    if (!legs?.length) return false;
    return legs.some(l => l.phase === 'dem' || l.phase === 'compute');
  });

  legAt(legIndex: number): LegSamplingProgress | null {
    const legs = this.state()?.legs;
    if (!legs || legIndex < 0 || legIndex >= legs.length) return null;
    return legs[legIndex];
  }

  begin(legCount: number): void {
    const n = Math.max(0, legCount);
    this.state.set({
      legs: Array.from({ length: n }, () => ({
        phase: 'pending' as const,
        percent: 0
      }))
    });
  }

  /** Réinitialise l’avancement d’une branche (réessai DEM) sans toucher aux autres. */
  resetLeg(legIndex: number, legCount: number): void {
    const n = Math.max(0, legCount);
    this.state.update(current => {
      const legs =
        current?.legs.length === n
          ? [...current.legs]
          : Array.from({ length: n }, (_, i) =>
              current?.legs[i] ?? { phase: 'done' as const, percent: 100 }
            );
      if (legIndex >= 0 && legIndex < n) {
        legs[legIndex] = { phase: 'pending', percent: 0 };
      }
      return { legs };
    });
  }

  /**
   * Avancement DEM par fenêtre de tuiles (0 → 75 %).
   * Ne diminue jamais le % de la branche (évite les retours en arrière après un fetch étendu).
   */
  setDemChunk(
    legIndex: number,
    _legCount: number,
    chunkIndex: number,
    chunkCount: number,
    _legLabel: string | null = null
  ): void {
    const chunks = Math.max(1, chunkCount);
    const demTarget = Math.round(((chunkIndex + 1) / chunks) * DEM_MAX_PERCENT);
    this.patchLeg(legIndex, prev => ({
      phase: 'dem',
      percent: bumpPercent(prev.percent, demTarget)
    }));
  }

  /** Terrain déjà en cache local : saute les tuiles, affiche 75 %. */
  markTerrainReady(legIndex: number): void {
    this.patchLeg(legIndex, prev => ({
      phase: 'dem',
      percent: bumpPercent(prev.percent, DEM_MAX_PERCENT)
    }));
  }

  /** Calcul de l'enveloppe (90 %), une seule fois par branche après tout le DEM. */
  setComputeLeg(legIndex: number, _legCount: number, _legLabel: string | null = null): void {
    this.patchLeg(legIndex, prev => ({
      phase: 'compute',
      percent: bumpPercent(prev.percent, COMPUTE_PERCENT)
    }));
  }

  completeLeg(legIndex: number): void {
    this.patchLeg(legIndex, () => ({ phase: 'done', percent: 100 }));
  }

  end(): void {
    this.state.set(null);
  }

  /** Mise à jour atomique (safe si plusieurs branches progressent en parallèle). */
  private patchLeg(
    legIndex: number,
    update: (prev: LegSamplingProgress) => LegSamplingProgress
  ): void {
    this.state.update(current => {
      if (!current || legIndex < 0 || legIndex >= current.legs.length) {
        return current;
      }
      const legs = [...current.legs];
      legs[legIndex] = update(legs[legIndex]);
      return { legs };
    });
  }
}

function bumpPercent(current: number, target: number): number {
  return Math.min(100, Math.max(current, target));
}

export interface TerrainSamplingProgressContext {
  legIndex: number;
  legCount: number;
  legLabel?: string;
}
