import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Button } from 'primeng/button';
import { TranslatePipe } from '../../../i18n/translate.pipe';
import { DistanceResult } from '../../../services/distance.service';
import { CircuitListItem } from '../../../models/circuit-list-item.model';

@Component({
  selector: 'app-circuit-map-summary',
  standalone: true,
  imports: [CommonModule, Button, TranslatePipe],
  templateUrl: './circuit-map-summary.component.html',
  styleUrl: './circuit-map-summary.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CircuitMapSummaryComponent {
  distanceResult = input<DistanceResult | null>(null);
  pointCount = input(0);
  items = input<CircuitListItem[]>([]);

  itemClick = output<CircuitListItem>();
  editCircuit = output<void>();
}
