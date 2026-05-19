import { Component, inject, input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SavedCircuitService } from '../../services/saved-circuit.service';
import { SavedCircuit } from '../../models/saved-circuit.model';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { UiFeedbackService } from '../../services/ui-feedback.service';
import { TranslateService } from '../../i18n/translate.service';
import { TranslatePipe } from '../../i18n/translate.pipe';

@Component({
  selector: 'app-circuit-library',
  standalone: true,
  imports: [CommonModule, FormsModule, Button, InputText, Select, TranslatePipe],
  templateUrl: './circuit-library.component.html',
  styleUrls: ['./circuit-library.component.scss']
})
export class CircuitLibraryComponent {
  private savedCircuitService = inject(SavedCircuitService);
  private uiFeedback = inject(UiFeedbackService);
  private i18n = inject(TranslateService);

  canSave = input(false);
  selectedCircuitId = input<string | null>(null);

  circuitLoaded = output<string>();
  saveRequested = output<{ label: string; notes: string; updateId: string | null }>();

  circuits = this.savedCircuitService.circuits;
  activeCircuitId = this.savedCircuitService.activeCircuitId;

  saveLabel = signal('');
  saveNotes = signal('');
  filterQuery = signal('');
  editingId = signal<string | null>(null);
  editLabel = signal('');
  importMessage = signal<string | null>(null);
  quickPickId = signal<string | null>(null);

  circuitQuickOptions = computed(() => {
    this.i18n.locale();
    return this.circuits().map(c => ({
      id: c.id,
      label: `${c.label} (${this.i18n.t('library.ptsMeta', { count: c.waypoints.length })})${c.profile.pilotName ? ` — ${c.profile.pilotName}` : ''}`
    }));
  });

  filteredCircuits = computed(() => {
    const q = this.filterQuery().trim().toLowerCase();
    const list = this.circuits();
    if (!q) return list;
    return list.filter(c => {
      const haystack = [
        c.label,
        c.taskName,
        c.notes,
        c.profile.pilotName,
        c.profile.gliderId,
        c.profile.gliderType,
        c.profile.compId,
        c.profile.compClass
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  });

  onQuickPickChange(id: string | null): void {
    this.quickPickId.set(id);
    if (!id) {
      return;
    }
    try {
      this.loadCircuit(id);
    } finally {
      this.quickPickId.set(null);
    }
  }

  loadCircuit(id: string): void {
    if (this.savedCircuitService.getCircuit(id)) {
      this.circuitLoaded.emit(id);
      this.importMessage.set(this.i18n.t('library.loaded'));
    }
  }

  requestSave(): void {
    const label = this.saveLabel().trim();
    if (!label && !this.canSave()) return;
    this.saveRequested.emit({
      label,
      notes: this.saveNotes(),
      updateId: this.editingId()
    });
  }

  startUpdate(circuit: SavedCircuit, e?: unknown): void {
    (e as Event | undefined)?.stopPropagation?.();
    this.editingId.set(circuit.id);
    this.saveLabel.set(circuit.label);
    this.saveNotes.set(circuit.notes ?? '');
  }

  cancelUpdate(): void {
    this.editingId.set(null);
    this.saveLabel.set('');
    this.saveNotes.set('');
  }

  async deleteCircuit(id: string, e?: unknown): Promise<void> {
    (e as Event | undefined)?.stopPropagation?.();
    const ok = await this.uiFeedback.confirm({
      header: this.i18n.t('common.delete'),
      message: this.i18n.t('library.deleteConfirm'),
      acceptLabel: this.i18n.t('common.delete'),
      acceptButtonStyleClass: 'p-button-danger'
    });
    if (!ok) return;
    this.savedCircuitService.deleteCircuit(id);
    if (this.editingId() === id) this.cancelUpdate();
    this.uiFeedback.success(this.i18n.t('library.deleted'));
  }

  duplicateCircuit(id: string, e?: unknown): void {
    (e as Event | undefined)?.stopPropagation?.();
    this.savedCircuitService.duplicateCircuit(id);
  }

  startRename(circuit: SavedCircuit, e?: unknown): void {
    (e as Event | undefined)?.stopPropagation?.();
    const name = prompt(this.i18n.t('library.renamePrompt'), circuit.label);
    if (name?.trim()) {
      this.savedCircuitService.renameCircuit(circuit.id, name);
    }
  }

  exportAll(): void {
    this.savedCircuitService.downloadExport();
    this.importMessage.set(this.i18n.t('library.exported'));
  }

  onImportFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      void this.finishImport(reader.result as string);
    };
    reader.readAsText(file);
    (event.target as HTMLInputElement).value = '';
  }

  private async finishImport(json: string): Promise<void> {
    const merge = await this.uiFeedback.confirm({
      header: this.i18n.t('common.import'),
      message: this.i18n.t('library.importMerge'),
      acceptLabel: this.i18n.t('common.yes'),
      rejectLabel: this.i18n.t('common.no')
    });
    try {
      const count = this.savedCircuitService.importFromJson(json, merge);
      this.uiFeedback.success(this.i18n.t('library.imported', { count }));
    } catch {
      this.uiFeedback.error(this.i18n.t('library.importError'));
    }
  }

  circuitSummary(c: SavedCircuit): string {
    const parts: string[] = [];
    if (c.profile.pilotName) parts.push(c.profile.pilotName);
    if (c.profile.gliderId) parts.push(c.profile.gliderId);
    return parts.join(' · ') || '—';
  }

  clearSaveForm(): void {
    this.saveLabel.set('');
    this.saveNotes.set('');
    this.editingId.set(null);
  }

  isActive(id: string): boolean {
    return this.activeCircuitId() === id || this.selectedCircuitId() === id;
  }
}
