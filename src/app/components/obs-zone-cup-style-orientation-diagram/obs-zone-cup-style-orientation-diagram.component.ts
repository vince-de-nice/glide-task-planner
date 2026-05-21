import { Component, computed, input } from '@angular/core';
import { ObservationZoneConfig } from '../../models/observation-zone.model';
import {
  buildCupStyleOrientationPreview,
  cupStyleAxisLine,
  cupStylePolarToSvg,
  CUP_STYLE_ORIENTATION_CENTER,
  CUP_STYLE_ORIENTATION_VIEWBOX,
  CupStyleRefKind,
  CupStyleValue
} from '../../utils/cup-style-orientation-preview.util';
import { ObsZoneLegContext } from '../../utils/obs-zone-map.util';

@Component({
  selector: 'app-obs-zone-cup-style-orientation-diagram',
  standalone: true,
  templateUrl: './obs-zone-cup-style-orientation-diagram.component.html',
  styleUrl: './obs-zone-cup-style-orientation-diagram.component.scss'
})
export class ObsZoneCupStyleOrientationDiagramComponent {
  style = input.required<CupStyleValue>();
  baseZone = input.required<ObservationZoneConfig>();
  legContext = input<ObsZoneLegContext | null>(null);

  readonly viewBox = CUP_STYLE_ORIENTATION_VIEWBOX;
  readonly center = CUP_STYLE_ORIENTATION_CENTER;
  readonly arrowMarkerId = `cup-style-axis-${Math.random().toString(36).slice(2, 9)}`;

  readonly preview = computed(() =>
    buildCupStyleOrientationPreview(this.style(), this.legContext(), this.baseZone())
  );

  readonly axisLine = computed(() => cupStyleAxisLine(this.preview().axisBearingDeg));

  readonly refMarkers = computed(() =>
    this.preview().markers.filter(m => m.kind !== 'current' && m.kind !== 'north')
  );

  refPosition(kind: CupStyleRefKind): { x: number; y: number } | null {
    const m = this.preview().markers.find(marker => marker.kind === kind);
    if (!m) return null;
    return cupStylePolarToSvg(m.bearingDeg, 32);
  }

  refLabelOffset(kind: CupStyleRefKind): { x: number; y: number; anchor: string } {
    const pos = this.refPosition(kind);
    if (!pos) return { x: 50, y: 50, anchor: 'middle' };
    const dx = pos.x - this.center.cx;
    const dy = pos.y - this.center.cy;
    const len = Math.hypot(dx, dy) || 1;
    const lx = pos.x + (dx / len) * 8;
    const ly = pos.y + (dy / len) * 8;
    const anchor = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'start' : 'end') : 'middle';
    return { x: lx, y: ly, anchor };
  }
}
