import { Component, input, output, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Dialog } from 'primeng/dialog';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import { InputNumber } from 'primeng/inputnumber';
import { Checkbox } from 'primeng/checkbox';
import { ObsZonePreviewComponent } from '../obs-zone-preview/obs-zone-preview.component';
import { CircuitLeg } from '../../models/circuit.model';
import { Waypoint } from '../../models/waypoint.model';
import {
  CUP_STYLE_LABELS,
  OBS_ZONE_PRESETS,
  ObsZonePresetId,
  ObservationZoneConfig,
  observationZoneFromPreset,
  observationZoneShortLabel,
  normalizeObservationZone
} from '../../models/observation-zone.model';
import { formatElevationDisplay, resolveLegElevationM } from '../../utils/elevation.util';
import { circuitRoleShortLabel } from '../../models/circuit.model';

export interface CircuitLegZoneDialogSave {
  obsZone: ObservationZoneConfig;
  elevationM?: number;
}

@Component({
  selector: 'app-circuit-leg-zone-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Dialog,
    Button,
    Select,
    InputNumber,
    Checkbox,
    ObsZonePreviewComponent
  ],
  templateUrl: './circuit-leg-zone-dialog.component.html',
  styleUrl: './circuit-leg-zone-dialog.component.scss'
})
export class CircuitLegZoneDialogComponent {
  visible = input(false);
  leg = input<CircuitLeg | null>(null);
  waypoint = input<Waypoint | null>(null);
  legIndex = input(0);
  defaultRadiusM = input(400);
  /** Si défini, limite les préréglages proposés (règlement). */
  allowedPresetIds = input<ObsZonePresetId[] | null>(null);

  visibleChange = output<boolean>();
  saved = output<CircuitLegZoneDialogSave>();

  presetId = signal<ObsZonePresetId>('cylinder_fixed');
  cupStyle = signal<0 | 1 | 2 | 3 | 4>(0);
  r1M = signal(400);
  a1Deg = signal<number | null>(null);
  r2M = signal<number | null>(null);
  a2Deg = signal<number | null>(null);
  a12Deg = signal<number | null>(null);
  line = signal(false);
  useCustomElevation = signal(false);
  elevationM = signal<number | null>(null);

  readonly presetOptions = computed(() => {
    const role = this.leg()?.role;
    const allowed = this.allowedPresetIds();
    return OBS_ZONE_PRESETS.filter(p => {
      if (allowed?.length && !allowed.includes(p.id)) {
        return false;
      }
      return !p.forRoles || (role && p.forRoles.includes(role));
    });
  });

  readonly cupStyleOptions = Object.entries(CUP_STYLE_LABELS).map(([value, label]) => ({
    value: Number(value) as 0 | 1 | 2 | 3 | 4,
    label
  }));

  readonly roleLabel = computed(() => {
    const role = this.leg()?.role;
    return role ? circuitRoleShortLabel(role) : '';
  });

  readonly wpName = computed(() => this.waypoint()?.name ?? '');

  readonly effectiveElevation = computed(() => {
    const wp = this.waypoint();
    const leg = this.leg();
    if (!wp || !leg) return '—';
    if (this.useCustomElevation() && this.elevationM() != null) {
      return formatElevationDisplay(this.elevationM()!);
    }
    return formatElevationDisplay(resolveLegElevationM(wp, leg));
  });

  readonly zonePreview = computed(() => {
    const zone = this.buildZoneFromForm();
    return observationZoneShortLabel(zone);
  });

  readonly previewLeg = computed((): CircuitLeg | null => {
    const leg = this.leg();
    if (!leg) return null;
    return {
      ...leg,
      obsZone: normalizeObservationZone(
        this.buildZoneFromForm(),
        leg.role,
        this.defaultRadiusM()
      )
    };
  });

  constructor() {
    effect(() => {
      if (!this.visible()) return;
      const leg = this.leg();
      const wp = this.waypoint();
      if (!leg) return;
      const zone = normalizeObservationZone(
        leg.obsZone,
        leg.role,
        this.defaultRadiusM()
      );
      this.presetId.set(zone.presetId ?? 'cylinder_fixed');
      this.cupStyle.set(zone.cupStyle);
      this.r1M.set(zone.r1M);
      this.a1Deg.set(zone.a1Deg ?? null);
      this.r2M.set(zone.r2M ?? null);
      this.a2Deg.set(zone.a2Deg ?? null);
      this.a12Deg.set(zone.a12Deg ?? null);
      this.line.set(Boolean(zone.line));
      const elev = leg.elevationM ?? wp?.elevation;
      this.useCustomElevation.set(leg.elevationM != null);
      this.elevationM.set(elev ?? null);
    });
  }

  onPresetChange(value: unknown): void {
    const id = this.resolvePresetId(value);
    if (!id) return;
    this.applyPreset(id);
  }

  private resolvePresetId(value: unknown): ObsZonePresetId | null {
    if (value == null) return null;
    if (typeof value === 'string') return value as ObsZonePresetId;
    if (typeof value === 'object' && value !== null && 'id' in value) {
      const id = (value as { id: unknown }).id;
      return typeof id === 'string' ? (id as ObsZonePresetId) : null;
    }
    return null;
  }

  private applyPreset(id: ObsZonePresetId): void {
    this.presetId.set(id);
    if (id === 'custom') return;
    const z = observationZoneFromPreset(id, this.defaultRadiusM());
    this.cupStyle.set(z.cupStyle);
    this.r1M.set(z.r1M);
    this.a1Deg.set(z.a1Deg ?? null);
    this.r2M.set(z.r2M ?? null);
    this.a2Deg.set(z.a2Deg ?? null);
    this.a12Deg.set(z.a12Deg ?? null);
    this.line.set(Boolean(z.line));
  }

  onSave(): void {
    const leg = this.leg();
    if (!leg) return;
    const obsZone = normalizeObservationZone(
      this.buildZoneFromForm(),
      leg.role,
      this.defaultRadiusM()
    );
    const save: CircuitLegZoneDialogSave = { obsZone };
    if (this.useCustomElevation() && this.elevationM() != null) {
      save.elevationM = Math.round(this.elevationM()!);
    } else {
      save.elevationM = undefined;
    }
    this.saved.emit(save);
    this.close();
  }

  close(): void {
    this.visibleChange.emit(false);
  }

  private buildZoneFromForm(): ObservationZoneConfig {
    return {
      presetId: this.presetId(),
      cupStyle: this.cupStyle(),
      r1M: this.r1M(),
      a1Deg: this.a1Deg() ?? undefined,
      r2M: this.r2M() ?? undefined,
      a2Deg: this.a2Deg() ?? undefined,
      a12Deg: this.a12Deg() ?? undefined,
      line: this.line()
    };
  }
}
