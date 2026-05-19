import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  ViewChild
} from '@angular/core';
import { Dialog } from 'primeng/dialog';
import { Button } from 'primeng/button';
import { CircuitLibraryComponent } from '../../circuit-library/circuit-library.component';
import { TranslatePipe } from '../../../i18n/translate.pipe';

@Component({
  selector: 'app-circuits-library-dialog',
  standalone: true,
  imports: [Dialog, Button, CircuitLibraryComponent, TranslatePipe],
  templateUrl: './circuits-library-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CircuitsLibraryDialogComponent {
  @ViewChild(CircuitLibraryComponent) circuitLibrary?: CircuitLibraryComponent;

  visible = input(false);
  visibleChange = output<boolean>();
  canSave = input(false);
  selectedCircuitId = input<string | null>(null);

  saveRequested = output<{ label: string; notes: string; updateId: string | null }>();
  circuitLoaded = output<string>();

  onVisibleChange(v: boolean): void {
    this.visibleChange.emit(v);
  }

  close(): void {
    this.visibleChange.emit(false);
  }

  clearSaveForm(): void {
    this.circuitLibrary?.clearSaveForm();
  }
}
