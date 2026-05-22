import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';
import { TranslatePipe } from '../../i18n/translate.pipe';
import {
  SAFETY_PARAMS_BOUNDS,
  type SafetyParams
} from '../../models/safety-params.model';
import type { LegChartLabels } from './leg-profile-chart.component';

@Component({
  selector: 'app-safety-profile-params-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule, Button, InputNumber, TranslatePipe],
  templateUrl: './safety-profile-params-drawer.component.html',
  styleUrl: './safety-profile-params-drawer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SafetyProfileParamsDrawerComponent {
  readonly open = input.required<boolean>();
  readonly glideRatio = input.required<number>();
  readonly arrivalMarginM = input.required<number>();
  readonly groundMarginM = input.required<number>();
  readonly chartLabels = input.required<LegChartLabels>();
  readonly noLandables = input(false);

  readonly bounds = SAFETY_PARAMS_BOUNDS;

  readonly closePanel = output<void>();
  readonly glideRatioChange = output<number>();
  readonly arrivalMarginChange = output<number>();
  readonly groundMarginChange = output<number>();
  readonly resetDefaults = output<void>();
}
