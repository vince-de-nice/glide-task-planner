import { Injectable, signal } from '@angular/core';
import { DEFAULT_FLARM_PROFILE, FlarmProfile } from '../models/flarm-profile.model';
import { readMigratedLocalStorage } from '../utils/local-storage-migrate.util';

const STORAGE_KEY = 'gc_flarm_profile';
const LEGACY_STORAGE_KEYS = ['vav_flarm_profile'];

@Injectable({
  providedIn: 'root'
})
export class FlarmProfileService {
  profile = signal<FlarmProfile>({ ...DEFAULT_FLARM_PROFILE });

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage(): void {
    try {
      const raw = readMigratedLocalStorage(STORAGE_KEY, LEGACY_STORAGE_KEYS);
      if (!raw) return;
      const data = JSON.parse(raw) as Partial<FlarmProfile>;
      this.profile.set({
        ...DEFAULT_FLARM_PROFILE,
        ...data,
        logInterval: clampLogInterval(data.logInterval ?? DEFAULT_FLARM_PROFILE.logInterval)
      });
    } catch {
      /* ignore */
    }
  }

  private saveToStorage(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.profile()));
  }

  updateProfile(patch: Partial<FlarmProfile>): void {
    this.profile.update(current => ({
      ...current,
      ...patch,
      ...(patch.logInterval !== undefined
        ? { logInterval: clampLogInterval(patch.logInterval) }
        : {})
    }));
    this.saveToStorage();
  }

  setPilotName(value: string): void {
    this.updateProfile({ pilotName: value });
  }

  setGliderType(value: string): void {
    this.updateProfile({ gliderType: value });
  }

  setGliderId(value: string): void {
    this.updateProfile({ gliderId: value });
  }

  setCompId(value: string): void {
    this.updateProfile({ compId: value });
  }

  setCompClass(value: string): void {
    this.updateProfile({ compClass: value });
  }

  setLogInterval(value: number): void {
    this.updateProfile({ logInterval: clampLogInterval(value) });
  }
}

function clampLogInterval(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_FLARM_PROFILE.logInterval;
  return Math.min(8, Math.max(1, Math.round(value)));
}
