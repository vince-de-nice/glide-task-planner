import { Component, computed, inject, input, output } from '@angular/core';
import { ObservationZoneConfig } from '../../models/observation-zone.model';
import {
  buildCupStyleOrientationPreview,
  CupStyleValue
} from '../../utils/cup-style-orientation-preview.util';

export type { CupStyleValue };
import { ObsZoneLegContext } from '../../utils/obs-zone-map.util';
import { ObsZoneCupStyleOrientationDiagramComponent } from '../obs-zone-cup-style-orientation-diagram/obs-zone-cup-style-orientation-diagram.component';
import { TranslateService } from '../../i18n/translate.service';
import { TranslatePipe } from '../../i18n/translate.pipe';

const CUP_STYLES = [0, 1, 2, 3, 4] as const;

@Component({
  selector: 'app-obs-zone-cup-style-picker',
  standalone: true,
  imports: [ObsZoneCupStyleOrientationDiagramComponent, TranslatePipe],
  templateUrl: './obs-zone-cup-style-picker.component.html',
  styleUrl: './obs-zone-cup-style-picker.component.scss'
})
export class ObsZoneCupStylePickerComponent {
  private i18n = inject(TranslateService);

  baseZone = input.required<ObservationZoneConfig>();
  selectedStyle = input.required<CupStyleValue>();
  legContext = input<ObsZoneLegContext | null>(null);

  stylePick = output<CupStyleValue>();

  readonly tiles = computed(() => {
    this.i18n.locale();
    const base = this.baseZone();
    const ctx = this.legContext();

    return CUP_STYLES.map(value => {
      const orient = buildCupStyleOrientationPreview(value, ctx, base);
      return {
        value,
        label: this.i18n.t(`zoneCup.style${value}`),
        referenceText: this.i18n.t(orient.referenceKey, orient.referenceParams),
        bearingText: orient.axisAvailable
          ? this.i18n.t('zoneCup.styleOrientation.axis', { bearing: orient.referenceParams['bearing'] })
          : null,
        selected: this.selectedStyle() === value
      };
    });
  });

  onPick(value: CupStyleValue): void {
    this.stylePick.emit(value);
  }
}
