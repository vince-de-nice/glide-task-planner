import { Component, computed, input } from '@angular/core';
import { CircuitLegRole } from '../../models/circuit.model';
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
  /** Axe du secteur (° vrai) — même logique que la carte / l’aperçu. */
  referenceBearingDeg = input(0);
  legRole = input<CircuitLegRole | null>(null);

  readonly viewBox = OBS_ZONE_CUP_DIAGRAM_VIEWBOX;

  diagram = computed((): ObsZoneCupDiagramView | null => {
    const z = this.zone();
    const role = this.legRole();
    return z ? buildObsZoneCupDiagram(z, this.referenceBearingDeg(), role ?? undefined) : null;
  });
}
