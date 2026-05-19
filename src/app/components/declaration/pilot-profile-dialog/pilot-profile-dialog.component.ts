import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Dialog } from 'primeng/dialog';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { FlarmProfileService } from '../../../services/flarm-profile.service';
import { TranslatePipe } from '../../../i18n/translate.pipe';

@Component({
  selector: 'app-pilot-profile-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, Dialog, Button, InputText, TranslatePipe],
  templateUrl: './pilot-profile-dialog.component.html',
  styleUrl: './pilot-profile-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PilotProfileDialogComponent {
  flarmProfileService = inject(FlarmProfileService);
  flarmProfile = this.flarmProfileService.profile;

  visible = input(false);
  visibleChange = output<boolean>();

  onVisibleChange(v: boolean): void {
    this.visibleChange.emit(v);
  }

  close(): void {
    this.visibleChange.emit(false);
  }
}
