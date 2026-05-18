import { Component, inject, input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SavedCircuitService } from '../../services/saved-circuit.service';
import { SavedCircuit } from '../../models/saved-circuit.model';

@Component({
  selector: 'app-circuit-library',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './circuit-library.component.html',
  styleUrls: ['./circuit-library.component.scss']
})
export class CircuitLibraryComponent {
  private savedCircuitService = inject(SavedCircuitService);

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

  onQuickSelect(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    if (id) this.loadCircuit(id);
    (event.target as HTMLSelectElement).value = '';
  }

  loadCircuit(id: string): void {
    if (this.savedCircuitService.getCircuit(id)) {
      this.circuitLoaded.emit(id);
      this.importMessage.set('Circuit chargé.');
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

  startUpdate(circuit: SavedCircuit, event: Event): void {
    event.stopPropagation();
    this.editingId.set(circuit.id);
    this.saveLabel.set(circuit.label);
    this.saveNotes.set(circuit.notes ?? '');
  }

  cancelUpdate(): void {
    this.editingId.set(null);
    this.saveLabel.set('');
    this.saveNotes.set('');
  }

  deleteCircuit(id: string, event: Event): void {
    event.stopPropagation();
    if (confirm('Supprimer ce circuit de la bibliothèque ?')) {
      this.savedCircuitService.deleteCircuit(id);
      if (this.editingId() === id) this.cancelUpdate();
    }
  }

  duplicateCircuit(id: string, event: Event): void {
    event.stopPropagation();
    this.savedCircuitService.duplicateCircuit(id);
  }

  startRename(circuit: SavedCircuit, event: Event): void {
    event.stopPropagation();
    const name = prompt('Nouveau nom du circuit :', circuit.label);
    if (name?.trim()) {
      this.savedCircuitService.renameCircuit(circuit.id, name);
    }
  }

  exportAll(): void {
    this.savedCircuitService.downloadExport();
    this.importMessage.set('Bibliothèque exportée.');
  }

  onImportFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const merge = confirm(
          'Fusionner avec les circuits existants ?\nOK = fusionner · Annuler = remplacer tout'
        );
        const count = this.savedCircuitService.importFromJson(reader.result as string, merge);
        this.importMessage.set(`${count} circuit(s) importé(s).`);
      } catch {
        this.importMessage.set('Fichier JSON invalide.');
      }
    };
    reader.readAsText(file);
    (event.target as HTMLInputElement).value = '';
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
