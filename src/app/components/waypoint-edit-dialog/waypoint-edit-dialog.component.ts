import {
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  effect,
  untracked
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Waypoint } from '../../models/waypoint.model';
import { WAYPOINT_TYPE_ORDER } from '../../utils/waypoint-type-display.util';
import { Dialog } from 'primeng/dialog';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { Select } from 'primeng/select';
import { TranslateService } from '../../i18n/translate.service';
import { TranslatePipe } from '../../i18n/translate.pipe';

export type WaypointEditPayload = Omit<Waypoint, 'id'>;

@Component({
  selector: 'app-waypoint-edit-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, Dialog, Button, InputText, Select, TranslatePipe],
  templateUrl: './waypoint-edit-dialog.component.html',
  styleUrls: ['./waypoint-edit-dialog.component.scss']
})
export class WaypointEditDialogComponent {
  private i18n = inject(TranslateService);

  open = input(false);
  waypoint = input<Waypoint | null>(null);
  isCreate = input(false);
  /** Relief MapLibre (carte tâche) : remplit l’altitude pour les points personnalisés. */
  lookupTerrainElevationM = input<
    ((
      lat: number,
      lng: number,
      onResult: (m: number | undefined) => void
    ) => () => void) | null
  >(null);

  save = output<WaypointEditPayload>();
  dismissed = output<void>();

  form = signal<WaypointEditPayload>(this.emptyForm());
  /** L’utilisateur a modifié l’altitude à la main — ne pas écraser. */
  private elevationManual = signal(false);
  private elevationLookupCancel: (() => void) | null = null;

  readonly types = computed(() => {
    this.i18n.locale();
    return WAYPOINT_TYPE_ORDER.map(t => ({
      value: t,
      label: this.i18n.t(`wpType.${t}.description`)
    }));
  });

  readonly elevationFromTerrain = computed(() => {
    this.i18n.locale();
    return this.i18n.t('waypointEdit.elevationTerrainHint');
  });

  readonly showTerrainElevationHint = computed(
    () =>
      this.form().type === 'custom' &&
      this.form().elevation != null &&
      !this.elevationManual()
  );

  constructor() {
    effect(() => {
      const wp = this.waypoint();
      if (wp) {
        this.elevationManual.set(wp.elevation != null);
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
        this.elevationManual.set(false);
        this.form.set(this.emptyForm());
      }
    });

    effect(() => {
      const open = this.open();
      const isCreate = this.isCreate();
      const lookup = this.lookupTerrainElevationM();
      const f = this.form();
      if (!open || !isCreate || !lookup || f.type !== 'custom') {
        this.cancelElevationLookup();
        return;
      }
      if (this.elevationManual()) return;

      const lat = Number(f.latitude);
      const lng = Number(f.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      this.cancelElevationLookup();
      this.elevationLookupCancel = lookup(lat, lng, elev => {
        if (this.elevationManual() || elev == null) return;
        const cur = untracked(() => this.form());
        if (cur.type !== 'custom') return;
        if (
          Math.abs(cur.latitude - lat) > 1e-7 ||
          Math.abs(cur.longitude - lng) > 1e-7
        ) {
          return;
        }
        if (cur.elevation === elev) return;
        untracked(() => this.form.update(prev => ({ ...prev, elevation: elev })));
      });
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
    this.cancelElevationLookup();
    this.dismissed.emit();
  }

  onDialogVisibleChange(visible: boolean): void {
    if (!visible) {
      this.cancelElevationLookup();
      this.dismissed.emit();
    }
  }

  onElevationChange(raw: string | number): void {
    this.elevationManual.set(true);
    this.patchForm({
      elevation: raw === '' || raw == null ? undefined : Number(raw)
    });
  }

  patchForm(partial: Partial<WaypointEditPayload>): void {
    this.form.update(f => ({ ...f, ...partial }));
  }

  private cancelElevationLookup(): void {
    this.elevationLookupCancel?.();
    this.elevationLookupCancel = null;
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
