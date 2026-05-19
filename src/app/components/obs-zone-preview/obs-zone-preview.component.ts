import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { CircuitLegRole } from '../../models/circuit.model';
import { obsZoneMapColors } from '../../utils/obs-zone-map.util';
import {
  OBS_ZONE_PREVIEW_VIEWBOX,
  ObsZonePreviewView
} from '../../utils/obs-zone-preview.util';

@Component({
  selector: 'app-obs-zone-preview',
  standalone: true,
  templateUrl: './obs-zone-preview.component.html',
  styleUrl: './obs-zone-preview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ObsZonePreviewComponent {
  previewView = input<ObsZonePreviewView | null>(null);
  role = input<CircuitLegRole>('turnpoint');

  readonly viewBox = OBS_ZONE_PREVIEW_VIEWBOX;
  readonly colors = computed(() => obsZoneMapColors(this.role()));
}
