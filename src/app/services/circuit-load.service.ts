import { Injectable, inject } from '@angular/core';
import { CircuitUnresolvedPolicy } from '../models/saved-circuit.model';
import { FlarmProfileService } from './flarm-profile.service';
import { SavedCircuitService } from './saved-circuit.service';
import { TaskStateService } from './task-state.service';

/** Applique un circuit sauvegardé à la tâche courante (profil + legs). */
@Injectable({
  providedIn: 'root'
})
export class CircuitLoadService {
  private savedCircuitService = inject(SavedCircuitService);
  private taskState = inject(TaskStateService);
  private flarmProfileService = inject(FlarmProfileService);

  applyToCurrentTask(
    circuitId: string,
    unresolvedPolicy: CircuitUnresolvedPolicy = 'create'
  ): boolean {
    const applied = this.savedCircuitService.applyCircuit(circuitId, unresolvedPolicy);
    if (!applied) {
      return false;
    }
    this.flarmProfileService.updateProfile(applied.profile);
    this.taskState.loadTask(
      applied.circuitLegs,
      applied.taskName,
      applied.regulation
    );
    return true;
  }
}
