import { Component, computed, input } from '@angular/core';
import { ObservationZoneConfig } from '../../models/observation-zone.model';
import {
  OBS_ZONE_CUP_DIAGRAM_VIEWBOX,
  ObsZoneCupDiagramView,
  buildObsZoneCupDiagram
} from '../../utils/obs-zone-cup-diagram.util';

@Component({
  selector: 'app-obs-zone-cup-diagram',
  standalone: true,
  templateUrl: './obs-zone-cup-diagram.component.html',
  styleUrl: './obs-zone-cup-diagram.component.scss'
})
export class ObsZoneCupDiagramComponent {
  zone = input<ObservationZoneConfig | null>(null);

  readonly viewBox = OBS_ZONE_CUP_DIAGRAM_VIEWBOX;

  diagram = computed((): ObsZoneCupDiagramView | null => {
    const z = this.zone();
    return z ? buildObsZoneCupDiagram(z) : null;
  });
}
