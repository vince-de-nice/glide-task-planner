import { Component, computed, inject, input, output } from '@angular/core';
import {
  applyCupZoneParamVisibility,
  normalizeObservationZone,
  ObservationZoneConfig
} from '../../models/observation-zone.model';
import { cupZoneReferenceBearingDeg, ObsZoneLegContext } from '../../utils/obs-zone-map.util';
import { ObsZoneCupDiagramComponent } from '../obs-zone-cup-diagram/obs-zone-cup-diagram.component';
import { TranslateService } from '../../i18n/translate.service';
import { TranslatePipe } from '../../i18n/translate.pipe';

const CUP_STYLES = [0, 1, 2, 3, 4] as const;
export type CupStyleValue = (typeof CUP_STYLES)[number];

@Component({
  selector: 'app-obs-zone-cup-style-picker',
  standalone: true,
  imports: [ObsZoneCupDiagramComponent, TranslatePipe],
  templateUrl: './obs-zone-cup-style-picker.component.html',
  styleUrl: './obs-zone-cup-style-picker.component.scss'
})
export class ObsZoneCupStylePickerComponent {
  private i18n = inject(TranslateService);

  /** Zone en cours d’édition (R1, secteur, ligne…) — seul le style varie par tuile. */
  baseZone = input.required<ObservationZoneConfig>();
  selectedStyle = input.required<CupStyleValue>();
  defaultRadiusM = input(400);
  legContext = input<ObsZoneLegContext | null>(null);

  stylePick = output<CupStyleValue>();

  readonly tiles = computed(() => {
    this.i18n.locale();
    const base = this.baseZone();
    const ctx = this.legContext();
    const leg = ctx?.leg;
    const r = this.defaultRadiusM();

    return CUP_STYLES.map(value => {
      const raw: ObservationZoneConfig = { ...base, cupStyle: value };
      const zone =
        leg != null
          ? normalizeObservationZone(
              applyCupZoneParamVisibility(raw, leg.role),
              leg.role,
              r
            )
          : raw;
      return {
        value,
        label: this.i18n.t(`zoneCup.style${value}`),
        zone,
        referenceBearingDeg: ctx ? cupZoneReferenceBearingDeg(zone, ctx) : 0,
        selected: this.selectedStyle() === value
      };
    });
  });

  onPick(value: CupStyleValue): void {
    this.stylePick.emit(value);
  }
}
