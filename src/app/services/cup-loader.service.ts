import { Injectable, inject } from '@angular/core';
import { decodeCupFileBytes } from '../utils/cup-text-encoding.util';
import { TaskStateService } from './task-state.service';
import { CupDatabaseService } from './cup-database.service';

@Injectable({
  providedIn: 'root'
})
export class CupLoaderService {
  private cupDatabase = inject(CupDatabaseService);
  private taskState = inject(TaskStateService);

  async loadFromUrl(url: string, label: string | undefined, clearTask: boolean): Promise<number> {
    const count = await this.cupDatabase.fetchAndApply(url, label);
    if (clearTask) {
      this.taskState.clearSelection();
      this.taskState.resetTaskNameToToday();
    }
    return count;
  }

  async loadFromFile(file: File, clearTask: boolean): Promise<number> {
    const content = decodeCupFileBytes(await file.arrayBuffer());
    const count = this.cupDatabase.applyCupFile(content, file.name);
    if (clearTask) {
      this.taskState.clearSelection();
      this.taskState.resetTaskNameToToday();
    }
    return count;
  }
}
