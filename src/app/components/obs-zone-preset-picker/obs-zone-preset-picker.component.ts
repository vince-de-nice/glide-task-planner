import { Component, computed, input, output } from '@angular/core';
import { ObsZonePresetId, observationZoneFromPreset } from '../../models/observation-zone.model';
import { cupZoneReferenceBearingDeg, ObsZoneLegContext } from '../../utils/obs-zone-map.util';
import { ObsZoneCupDiagramComponent } from '../obs-zone-cup-diagram/obs-zone-cup-diagram.component';
import { TranslatePipe } from '../../i18n/translate.pipe';

export interface ObsZonePresetPickerOption {
  id: ObsZonePresetId;
  label: string;
}

@Component({
  selector: 'app-obs-zone-preset-picker',
  standalone: true,
  imports: [ObsZoneCupDiagramComponent, TranslatePipe],
  templateUrl: './obs-zone-preset-picker.component.html',
  styleUrl: './obs-zone-preset-picker.component.scss'
})
export class ObsZonePresetPickerComponent {
  options = input.required<ObsZonePresetPickerOption[]>();
  selectedId = input.required<ObsZonePresetId>();
  /** Rayon du règlement en cours (pas les champs du dialogue). */
  defaultRadiusM = input(400);
  /** Contexte circuit / waypoints pour l’orientation des aperçus. */
  legContext = input<ObsZoneLegContext | null>(null);

  presetPick = output<ObsZonePresetId>();

  readonly tiles = computed(() => {
    const r = this.defaultRadiusM();
    const ctx = this.legContext();
    return this.options().map(opt => {
      const zone = observationZoneFromPreset(opt.id, r);
      return {
        ...opt,
        zone,
        referenceBearingDeg: ctx ? cupZoneReferenceBearingDeg(zone, ctx) : 0,
        selected: opt.id === this.selectedId()
      };
    });
  });

  onPick(id: ObsZonePresetId): void {
    this.presetPick.emit(id);
  }
}
