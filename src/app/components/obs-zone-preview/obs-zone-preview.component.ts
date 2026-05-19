import { Component, computed, inject, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CircuitLeg } from '../../models/circuit.model';
import { TaskStateService } from '../../services/task-state.service';
import { WaypointService } from '../../services/waypoint.service';
import { obsZoneMapColors } from '../../utils/obs-zone-map.util';
import {
  OBS_ZONE_PREVIEW_VIEWBOX,
  buildObsZonePreview
} from '../../utils/obs-zone-preview.util';

@Component({
  selector: 'app-obs-zone-preview',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './obs-zone-preview.component.html',
  styleUrl: './obs-zone-preview.component.scss'
})
export class ObsZonePreviewComponent {
  private taskState = inject(TaskStateService);
  private waypointService = inject(WaypointService);

  /** Index dans circuitLegs() — source de vérité pour la zone. */
  legIndex = input.required<number>();
  /** Zone brouillon (dialogue) ; sinon lecture depuis taskState. */
  draftLeg = input<CircuitLeg | null>(null);

  readonly viewBox = OBS_ZONE_PREVIEW_VIEWBOX;

  private activeLeg = computed(() => {
    const draft = this.draftLeg();
    if (draft) return draft;
    const legs = this.taskState.circuitLegs();
    const i = this.legIndex();
    return i >= 0 && i < legs.length ? legs[i] : null;
  });

  preview = computed(() => {
    const legs = this.taskState.circuitLegs();
    const i = this.legIndex();
    const leg = this.activeLeg();
    if (!leg) return null;

    const wp = this.waypointService.getWaypoint(leg.waypointId);
    if (!wp) return null;

    const depLeg = legs.find(l => l.role === 'departure');
    const departure = depLeg
      ? (this.waypointService.getWaypoint(depLeg.waypointId) ?? null)
      : null;

    return buildObsZonePreview({
      legIndex: i,
      leg,
      waypoint: wp,
      prev: i > 0 ? (this.waypointService.getWaypoint(legs[i - 1].waypointId) ?? null) : null,
      next:
        i < legs.length - 1
          ? (this.waypointService.getWaypoint(legs[i + 1].waypointId) ?? null)
          : null,
      departure,
      defaultRadiusM: this.taskState.defaultZoneRadiusM()
    });
  });

  colors = computed(() => obsZoneMapColors(this.activeLeg()?.role ?? 'turnpoint'));
}
