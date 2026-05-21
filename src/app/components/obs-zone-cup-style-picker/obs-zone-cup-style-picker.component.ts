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
import { CircuitLegRole } from '../../models/circuit.model';

const CUP_STYLES = [0, 1, 2, 3, 4] as const;

/**
 * Styles CUP déconseillés selon le rôle du point et l'activation de Line=1.
 * - Départ + Line : Style 3 (orientation arrivée) est erroné.
 * - Arrivée + Line : Style 2 (orientation départ) est erroné.
 * - Style 1 (symétrique) : inhabituel sur départ/arrivée (conçu pour les virages).
 */
function discouragedStylesForRole(role: CircuitLegRole | null, lineActive: boolean): Set<number> {
  const set = new Set<number>();
  if (!role) return set;
  if (role === 'departure' && lineActive) set.add(3);
  if (role === 'arrival' && lineActive) set.add(2);
  if (role === 'departure' || role === 'arrival') set.add(1);
  return set;
}

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
  /** Rôle du point — permet de marquer les styles incohérents. */
  legRole = input<CircuitLegRole | null>(null);
  /** Indique si Line=1 est actif — conditionne les styles déconseillés. */
  lineActive = input(false);

  stylePick = output<CupStyleValue>();

  readonly tiles = computed(() => {
    this.i18n.locale();
    const base = this.baseZone();
    const ctx = this.legContext();
    const discouraged = discouragedStylesForRole(this.legRole(), this.lineActive());

    return CUP_STYLES.map(value => {
      const orient = buildCupStyleOrientationPreview(value, ctx, base);
      const isDiscouraged = discouraged.has(value);
      return {
        value,
        label: this.i18n.t(`zoneCup.style${value}`),
        referenceText: this.i18n.t(orient.referenceKey, orient.referenceParams),
        bearingText: orient.axisAvailable
          ? this.i18n.t('zoneCup.styleOrientation.axis', { bearing: orient.referenceParams['bearing'] })
          : null,
        selected: this.selectedStyle() === value,
        discouraged: isDiscouraged,
        discourageHint: isDiscouraged ? this.i18n.t('zoneCup.styleDiscouraged') : null
      };
    });
  });

  onPick(value: CupStyleValue): void {
    this.stylePick.emit(value);
  }
}
