import { Component, input, output, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Waypoint, WaypointType } from '../../models/waypoint.model';
import { Dialog } from 'primeng/dialog';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';

export type WaypointEditPayload = Omit<Waypoint, 'id'>;

@Component({
  selector: 'app-waypoint-edit-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, Dialog, Button, InputText, Select],
  templateUrl: './waypoint-edit-dialog.component.html',
  styleUrls: ['./waypoint-edit-dialog.component.scss']
})
export class WaypointEditDialogComponent {
  open = input(false);
  waypoint = input<Waypoint | null>(null);
  isCreate = input(false);

  save = output<WaypointEditPayload>();
  cancel = output<void>();

  form = signal<WaypointEditPayload>(this.emptyForm());

  readonly types: { value: WaypointType; label: string }[] = [
    { value: 'turnpoint', label: 'Point de virage' },
    { value: 'airfield', label: 'Aérodrome' },
    { value: 'landable', label: 'Posé possible' },
    { value: 'custom', label: 'Personnalisé' }
  ];

  constructor() {
    effect(() => {
      const wp = this.waypoint();
      if (wp) {
        this.form.set({
          name: wp.name,
          code: wp.code,
          country: wp.country,
          latitude: wp.latitude,
          longitude: wp.longitude,
          elevation: wp.elevation,
          description: wp.description,
          type: wp.type,
          cupFields: wp.cupFields
        });
      } else if (this.isCreate()) {
        this.form.set(this.emptyForm());
      }
    });
  }

  onSubmit(): void {
    const f = this.form();
    if (!f.name?.trim()) return;
    this.save.emit({
      ...f,
      name: f.name.trim(),
      latitude: Number(f.latitude),
      longitude: Number(f.longitude),
      elevation: f.elevation != null ? Number(f.elevation) : undefined
    });
  }

  onCancel(): void {
    this.cancel.emit();
  }

  onDialogVisibleChange(visible: boolean): void {
    if (!visible) {
      this.cancel.emit();
    }
  }

  patchForm(partial: Partial<WaypointEditPayload>): void {
    this.form.update(f => ({ ...f, ...partial }));
  }

  private emptyForm(): WaypointEditPayload {
    return {
      name: '',
      latitude: 0,
      longitude: 0,
      type: 'custom'
    };
  }
}
