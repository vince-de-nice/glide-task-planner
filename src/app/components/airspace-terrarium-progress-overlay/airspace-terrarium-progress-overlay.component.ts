import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AirspaceTerrariumProgressService } from '../../services/airspace-terrarium-progress.service';

/** Bandeau de progression DEM POAFF, ancré sur le conteneur carte (position relative). */
@Component({
  selector: 'app-airspace-terrarium-progress-overlay',
  standalone: true,
  templateUrl: './airspace-terrarium-progress-overlay.component.html',
  styleUrl: './airspace-terrarium-progress-overlay.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AirspaceTerrariumProgressOverlayComponent {
  readonly progress = inject(AirspaceTerrariumProgressService);
}
