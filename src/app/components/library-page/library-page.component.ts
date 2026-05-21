import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Button } from 'primeng/button';
import { Tag } from 'primeng/tag';
import { CircuitLibraryComponent } from '../circuit-library/circuit-library.component';
import { CupDatabaseService } from '../../services/cup-database.service';
import { FlarmProfileService } from '../../services/flarm-profile.service';
import { SavedCircuitService } from '../../services/saved-circuit.service';
import { TaskStateService } from '../../services/task-state.service';
import { UiFeedbackService } from '../../services/ui-feedback.service';
import { TranslateService } from '../../i18n/translate.service';
import { TranslatePipe } from '../../i18n/translate.pipe';

const WORKSPACE_TAB_KEY = 'gc_workspace_tab';

@Component({
  selector: 'app-library-page',
  standalone: true,
  imports: [CommonModule, RouterLink, Button, Tag, CircuitLibraryComponent, TranslatePipe],
  templateUrl: './library-page.component.html',
  styleUrl: './library-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LibraryPageComponent {
  private savedCircuitService = inject(SavedCircuitService);
  private taskState = inject(TaskStateService);
  private flarmProfileService = inject(FlarmProfileService);
  private cupDatabase = inject(CupDatabaseService);
  private uiFeedback = inject(UiFeedbackService);
  private i18n = inject(TranslateService);
  private router = inject(Router);

  circuitLegs = this.taskState.circuitLegs;
  circuitCount = this.savedCircuitService.circuitCount;

  readonly canSave = computed(() => this.circuitLegs().length >= 2);

  circuitMessage = signal<string | null>(null);

  onSaveRequested(event: { label: string; notes: string; updateId: string | null }): void {
    try {
      this.savedCircuitService.saveCircuit({
        label: event.label || this.taskState.taskName(),
        taskName: this.taskState.taskName(),
        profile: this.flarmProfileService.profile(),
        circuitLegs: this.circuitLegs(),
        regulation: this.taskState.regulation(),
        sourceUrl: this.cupDatabase.getSourceUrl(),
        notes: event.notes,
        updateId: event.updateId ?? undefined
      });
      const msg = event.updateId
        ? this.i18n.t('circuit.circuitUpdated')
        : this.i18n.t('circuit.circuitSaved');
      this.circuitMessage.set(msg);
      this.uiFeedback.success(msg);
    } catch (e) {
      const err = e instanceof Error ? e.message : this.i18n.t('library.saveFailed');
      this.circuitMessage.set(err);
      this.uiFeedback.error(err);
    }
  }

  onCircuitLoaded(circuitId: string): void {
    sessionStorage.setItem(WORKSPACE_TAB_KEY, 'circuit');
    void this.router.navigate(['/declaration']);
    this.uiFeedback.info(this.i18n.t('circuit.circuitLoaded'));
    this.circuitMessage.set(this.i18n.t('library.loaded'));
  }
}
