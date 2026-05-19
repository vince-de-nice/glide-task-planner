import {
  ChangeDetectionStrategy,
  Component,
  output,
  ViewChild
} from '@angular/core';
import { MapViewComponent } from '../../map-view/map-view.component';

@Component({
  selector: 'app-circuit-map-shell',
  standalone: true,
  imports: [MapViewComponent],
  template: `
    <section class="decl-panel decl-panel--map gc-card" aria-label="Carte">
      <div class="decl-map-wrap">
        <app-map-view (actionMessage)="actionMessage.emit($event)" />
      </div>
    </section>
  `,
  styleUrl: './circuit-map-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CircuitMapShellComponent {
  @ViewChild(MapViewComponent) mapView?: MapViewComponent;

  actionMessage = output<string>();
}
