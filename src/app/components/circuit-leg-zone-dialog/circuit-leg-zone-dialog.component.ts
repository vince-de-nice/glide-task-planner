import { Component, inject, input, output, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Dialog } from 'primeng/dialog';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import { InputNumber } from 'primeng/inputnumber';
import { Checkbox } from 'primeng/checkbox';
import { ObsZonePreviewComponent } from '../obs-zone-preview/obs-zone-preview.component';
import { ObsZoneCupDiagramComponent } from '../obs-zone-cup-diagram/obs-zone-cup-diagram.component';
import { CircuitLeg, circuitRoleShortLabel } from '../../models/circuit.model';
import { Waypoint } from '../../models/waypoint.model';
import {
  applyCupZoneParamVisibility,
  CUP_STYLE_LABELS,
  CupZoneParamKey,
  cupZoneParamVisibility,
  OBS_ZONE_PRESETS,
  ObsZonePresetId,
  ObservationZoneConfig,
  observationZoneFromPreset,
  observationZoneShortLabel,
  normalizeObservationZone
} from '../../models/observation-zone.model';
import { formatElevationDisplay, resolveLegElevationM } from '../../utils/elevation.util';
import { TaskStateService } from '../../services/task-state.service';
import { WaypointService } from '../../services/waypoint.service';
import { buildObsZonePreview } from '../../utils/obs-zone-preview.util';
import { cupZoneReferenceBearingDeg, ObsZoneLegContext } from '../../utils/obs-zone-map.util';

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
    ObsZonePreviewComponent,
    ObsZoneCupDiagramComponent
  ],
  templateUrl: './circuit-leg-zone-dialog.component.html',
  styleUrl: './circuit-leg-zone-dialog.component.scss'
})
export class CircuitLegZoneDialogComponent {
  private taskState = inject(TaskStateService);
  private waypointService = inject(WaypointService);

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
  /** Remonte les champs numériques après chargement (évite p-inputNumber vide). */
  zoneFormMounted = signal(false);

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

  private static readonly CUP_PARAM_LABELS: Record<CupZoneParamKey, string> = {
    style: 'Style',
    r1: 'R1',
    a1: 'A1',
    r2: 'R2',
    a2: 'A2',
    a12: 'A12',
    line: 'Line'
  };

  readonly presetHint = computed(() => {
    const opt = this.presetOptions().find(p => p.id === this.presetId());
    if (!opt) return '';
    if (this.presetId() !== 'custom') {
      return opt.description;
    }
    const vis = this.paramVisibility();
    const keys = (Object.keys(CircuitLegZoneDialogComponent.CUP_PARAM_LABELS) as CupZoneParamKey[])
      .filter(k => vis[k])
      .map(k => CircuitLegZoneDialogComponent.CUP_PARAM_LABELS[k]);
    return keys.length
      ? `Paramètres modifiables : ${keys.join(', ')}.`
      : opt.description;
  });

  readonly paramVisibility = computed(() => {
    const leg = this.leg();
    if (!leg) {
      return cupZoneParamVisibility(
        { cupStyle: 0, r1M: this.defaultRadiusM() },
        undefined
      );
    }
    const zone = normalizeObservationZone(
      this.buildZoneFromForm(),
      leg.role,
      this.defaultRadiusM()
    );
    return cupZoneParamVisibility(zone, { legRole: leg.role });
  });

  readonly normalizedZoneFromForm = computed(() => {
    const leg = this.leg();
    if (!leg) return null;
    return normalizeObservationZone(
      applyCupZoneParamVisibility(this.buildZoneFromForm(), leg.role),
      leg.role,
      this.defaultRadiusM()
    );
  });

  readonly zonePreview = computed(() => {
    const zone = this.normalizedZoneFromForm();
    return zone ? observationZoneShortLabel(zone) : '—';
  });

  readonly obsZoneLegContext = computed((): ObsZoneLegContext | null => {
    const leg = this.leg();
    const wp = this.waypoint();
    const zone = this.normalizedZoneFromForm();
    if (!leg || !wp || !zone) return null;

    const legs = this.taskState.circuitLegs();
    const i = this.legIndex();
    const depLeg = legs.find(l => l.role === 'departure');
    const departureWp = depLeg
      ? (this.waypointService.getWaypoint(depLeg.waypointId) ?? null)
      : null;

    return {
      legIndex: i,
      leg: { ...leg, obsZone: zone },
      waypoint: wp,
      prev: i > 0 ? (this.waypointService.getWaypoint(legs[i - 1]?.waypointId) ?? null) : null,
      next:
        i < legs.length - 1
          ? (this.waypointService.getWaypoint(legs[i + 1]?.waypointId) ?? null)
          : null,
      departure: departureWp,
      defaultRadiusM: this.defaultRadiusM()
    };
  });

  readonly cupDiagramRefBearing = computed(() => {
    const ctx = this.obsZoneLegContext();
    const zone = this.normalizedZoneFromForm();
    if (!ctx || !zone) return 0;
    return cupZoneReferenceBearingDeg(zone, ctx);
  });

  readonly previewView = computed(() => {
    const ctx = this.obsZoneLegContext();
    if (!ctx) return null;
    return buildObsZonePreview(ctx);
  });

  constructor() {
    effect(() => {
      if (!this.visible()) {
        this.zoneFormMounted.set(false);
        return;
      }
      const leg = this.leg();
      const wp = this.waypoint();
      if (!leg) return;

      this.zoneFormMounted.set(false);
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
      this.zoneFormMounted.set(true);
    });
  }

  onR1Change(value: number | null): void {
    const n = value != null && Number.isFinite(value) ? Math.round(value) : this.defaultRadiusM();
    this.r1M.set(Math.max(50, n));
    this.presetId.set('custom');
  }

  onA1Change(value: number | null | undefined): void {
    const a1 = value != null && Number.isFinite(value) ? Math.round(value) : null;
    this.a1Deg.set(a1);
    if (a1 == null || a1 <= 0) {
      this.r2M.set(null);
      this.a2Deg.set(null);
      this.a12Deg.set(null);
    }
    this.presetId.set('custom');
  }

  onCupStyleChange(value: 0 | 1 | 2 | 3 | 4): void {
    this.cupStyle.set(value);
    if (value !== 0) {
      this.a12Deg.set(null);
    }
    this.presetId.set('custom');
  }

  onA2Change(value: number | null | undefined): void {
    this.a2Deg.set(value != null && Number.isFinite(value) ? Math.round(value) : null);
    this.presetId.set('custom');
  }

  onA12Change(value: number | null | undefined): void {
    this.a12Deg.set(value != null && Number.isFinite(value) ? Math.round(value) : null);
    this.presetId.set('custom');
  }

  onOptionalRadiusChange(value: number | null | undefined): void {
    const r2 = value != null && Number.isFinite(value) && value > 0 ? Math.round(value) : null;
    this.r2M.set(r2);
    if (r2 == null) {
      this.a2Deg.set(null);
    }
    this.presetId.set('custom');
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
      applyCupZoneParamVisibility(this.buildZoneFromForm(), leg.role),
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
