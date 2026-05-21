import { Component, inject, input, output, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Dialog } from 'primeng/dialog';
import { Button } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';
import { Checkbox } from 'primeng/checkbox';
import { Message } from 'primeng/message';
import { ObsZoneCupDiagramComponent } from '../obs-zone-cup-diagram/obs-zone-cup-diagram.component';
import { ObsZonePresetPickerComponent } from '../obs-zone-preset-picker/obs-zone-preset-picker.component';
import {
  CupStyleValue,
  ObsZoneCupStylePickerComponent
} from '../obs-zone-cup-style-picker/obs-zone-cup-style-picker.component';
import { CircuitLeg } from '../../models/circuit.model';
import { Waypoint } from '../../models/waypoint.model';
import {
  applyCupZoneParamVisibility,
  CupZoneParamKey,
  cupZoneParamVisibility,
  OBS_ZONE_PRESETS,
  ObsZonePresetId,
  ObservationZoneConfig,
  observationZoneFromPreset,
  normalizeObservationZone
} from '../../models/observation-zone.model';
import { formatElevationDisplay, resolveLegElevationM } from '../../utils/elevation.util';
import { TaskStateService } from '../../services/task-state.service';
import { WaypointService } from '../../services/waypoint.service';
import { cupZoneReferenceBearingDeg, ObsZoneLegContext } from '../../utils/obs-zone-map.util';
import { TranslateService } from '../../i18n/translate.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import {
  circuitRoleShortLabelI18n,
  obsZonePresetDescriptionI18n,
  obsZonePresetLabelI18n
} from '../../i18n/display-i18n.util';

export interface CircuitLegZoneDialogSave {
  obsZone: ObservationZoneConfig;
  elevationM?: number;
}

const CUP_PARAM_I18N_KEYS: Record<CupZoneParamKey, string> = {
  style: 'zoneCup.paramStyle',
  r1: 'zoneCup.paramR1',
  a1: 'zoneCup.paramA1',
  r2: 'zoneCup.paramR2',
  a2: 'zoneCup.paramA2',
  a12: 'zoneCup.paramA12',
  line: 'zoneCup.paramLine'
};

@Component({
  selector: 'app-circuit-leg-zone-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Dialog,
    Button,
    InputNumber,
    Checkbox,
    Message,
    ObsZoneCupDiagramComponent,
    ObsZonePresetPickerComponent,
    ObsZoneCupStylePickerComponent,
    TranslatePipe
  ],
  templateUrl: './circuit-leg-zone-dialog.component.html',
  styleUrl: './circuit-leg-zone-dialog.component.scss'
})
export class CircuitLegZoneDialogComponent {
  private taskState = inject(TaskStateService);
  private waypointService = inject(WaypointService);
  private i18n = inject(TranslateService);

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

  /**
   * Verrouillage de Line=1 déduit des préréglages autorisés par le règlement.
   * - `true`  : Line=1 obligatoire (ex. departure_must_be_line)
   * - `false` : Line=1 interdit   (ex. departure_must_be_cylinder)
   * - `null`  : pas de contrainte sur la ligne
   */
  readonly lineLocked = computed((): boolean | null => {
    const allowed = this.allowedPresetIds();
    if (!allowed || allowed.length === 0) return null;
    const nonCustom = allowed.filter(id => id !== 'custom');
    if (nonCustom.length === 0) return null;
    const lineValues = nonCustom.map(id => Boolean(observationZoneFromPreset(id).line));
    if (lineValues.every(v => v)) return true;
    if (lineValues.every(v => !v)) return false;
    return null;
  });

  /**
   * Problème détecté sur la zone en cours d'édition (avant enregistrement).
   * Permet d'afficher un avertissement ou une erreur inline dans le dialog.
   */
  readonly previewIssue = computed((): { severity: 'error' | 'warn'; message: string } | null => {
    this.i18n.locale();
    const role = this.leg()?.role;
    if (!role || !this.zoneFormMounted()) return null;

    const locked = this.lineLocked();
    const lineOn = this.line();
    const idx = this.legIndex() + 1;

    // Violation de la contrainte Line
    if (locked === true && !lineOn) {
      const key = role === 'departure' ? 'rules.legDepartureLine' : 'rules.legArrivalLine';
      return { severity: 'error', message: this.i18n.t(key, { index: idx }) };
    }
    if (locked === false && lineOn) {
      return { severity: 'error', message: this.i18n.t('rules.legDepartureCylinder', { index: idx }) };
    }

    const r1 = this.r1M();
    const r2 = this.r2M();
    const a1 = this.a1Deg();
    const a2 = this.a2Deg();

    // R2 >= R1 : trou plus grand que la zone externe
    if (r2 != null && r2 > 0 && r2 >= r1) {
      return { severity: 'warn', message: this.i18n.t('zoneCup.r2LargerThanR1') };
    }
    // A2 > A1 : secteur interne plus ouvert que le secteur externe
    if (a1 != null && a2 != null && a2 > a1) {
      return { severity: 'warn', message: this.i18n.t('zoneCup.a2LargerThanA1') };
    }
    // arrival_ring : rayon minimum 3 km
    if (this.presetId() === 'arrival_ring' && r1 < 3000) {
      return { severity: 'warn', message: this.i18n.t('zoneCup.ringTooSmall', { min: 3 }) };
    }
    // Cylindre FAI départ : rayon minimum 10 km
    if (this.presetId() === 'start_cylinder_fai' && r1 < 10_000) {
      return { severity: 'warn', message: this.i18n.t('zoneCup.cylinderTooSmall', { km: 10 }) };
    }

    return null;
  });

  readonly presetOptions = computed(() => {
    this.i18n.locale();
    const role = this.leg()?.role;
    const allowed = this.allowedPresetIds();
    return OBS_ZONE_PRESETS.filter(p => {
      if (allowed?.length && !allowed.includes(p.id)) {
        return false;
      }
      return !p.forRoles || (role && p.forRoles.includes(role));
    }).map(p => ({
      id: p.id,
      label: obsZonePresetLabelI18n(p.id, this.i18n)
    }));
  });

  readonly roleLabel = computed(() => {
    this.i18n.locale();
    const role = this.leg()?.role;
    return role ? circuitRoleShortLabelI18n(role, this.i18n) : '';
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

  readonly presetHint = computed(() => {
    this.i18n.locale();
    const id = this.presetId();
    if (id !== 'custom') {
      return obsZonePresetDescriptionI18n(id, this.i18n);
    }
    const vis = this.paramVisibility();
    const keys = (Object.keys(CUP_PARAM_I18N_KEYS) as CupZoneParamKey[])
      .filter(k => vis[k])
      .map(k => this.i18n.t(CUP_PARAM_I18N_KEYS[k]));
    return keys.length
      ? this.i18n.t('zoneCup.editableParams', { params: keys.join(', ') })
      : obsZonePresetDescriptionI18n('custom', this.i18n);
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

  /** Waypoints du circuit + rayon règlement — pour les aperçus de la grille (pas le formulaire). */
  readonly obsZoneLegContext = computed((): ObsZoneLegContext | null => {
    const leg = this.leg();
    const wp = this.waypoint();
    if (!leg || !wp) return null;

    const legs = this.taskState.circuitLegs();
    const i = this.legIndex();
    const depLeg = legs.find(l => l.role === 'departure');
    const departureWp = depLeg
      ? (this.waypointService.getWaypoint(depLeg.waypointId) ?? null)
      : null;

    return {
      legIndex: i,
      leg,
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

  /** Cap pour le grand schéma (zone en cours d’édition dans le formulaire). */
  readonly cupDiagramRefBearing = computed(() => {
    const ctx = this.obsZoneLegContext();
    const zone = this.normalizedZoneFromForm();
    if (!ctx || !zone) return 0;
    return cupZoneReferenceBearingDeg(zone, {
      ...ctx,
      leg: { ...ctx.leg, obsZone: zone }
    });
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
      // Respecter le verrouillage de ligne
      const locked = this.lineLocked();
      if (locked === true) {
        this.line.set(true);
      } else if (locked === false) {
        this.line.set(false);
      } else {
        this.line.set(Boolean(zone.line));
      }
      const elev = leg.elevationM ?? wp?.elevation;
      this.useCustomElevation.set(leg.elevationM != null);
      this.elevationM.set(elev ?? null);
      this.zoneFormMounted.set(true);
    });
  }

  dialogHeader(): string {
    this.i18n.locale();
    return this.i18n.t('zoneCup.header', { name: this.wpName() });
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

  onCupStylePick(value: CupStyleValue): void {
    this.onCupStyleChange(value);
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

  onPresetPick(id: ObsZonePresetId): void {
    this.applyPreset(id);
  }

  /** Appelé par le template pour changer Line=1. */
  onLineChange(v: boolean): void {
    if (this.lineLocked() !== null) return; // verrouillé par le règlement
    this.line.set(v);
    this.presetId.set('custom');
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
    // Respecter le verrouillage de ligne imposé par le règlement
    const locked = this.lineLocked();
    if (locked === true) {
      this.line.set(true);
    } else if (locked === false) {
      this.line.set(false);
    } else {
      this.line.set(Boolean(z.line));
    }
  }

  onSave(): void {
    const leg = this.leg();
    if (!leg) return;
    // Appliquer le lock ligne avant de construire la zone
    const locked = this.lineLocked();
    if (locked === true) this.line.set(true);
    if (locked === false) this.line.set(false);

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
