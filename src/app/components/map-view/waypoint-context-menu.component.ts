import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CircuitLeg, CircuitLegRole } from '../../models/circuit.model';
import { Waypoint } from '../../models/waypoint.model';
import { MapPopupLabels } from '../../i18n/display-i18n.util';
import { formatElevationDisplay, resolveLegElevationM } from '../../utils/elevation.util';
import { WaypointMapAction } from './map-waypoint-popup.util';

@Component({
  selector: 'app-waypoint-context-menu',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="gc-wp-ctx"
      role="menu"
      [attr.aria-label]="menuAria()"
      (click)="$event.stopPropagation()"
    >
      <p class="gc-wp-ctx__title"><strong>{{ waypoint().name }}</strong></p>
      <p class="gc-wp-ctx__meta">{{ typeLabel() }}</p>
      @if (waypoint().code) {
        <p class="gc-wp-ctx__meta">
          {{ waypoint().code }}@if (waypoint().country) { · {{ waypoint().country }} }
        </p>
      }
      <p class="gc-wp-ctx__meta">{{ coords() }}</p>
      <p class="gc-wp-ctx__meta">{{ elevationLine() }}</p>
      @if (circuitLine(); as line) {
        <p class="gc-wp-ctx__circuit">{{ line }}</p>
      }
      <div class="gc-wp-ctx__actions">
        @if (canSetDeparture()) {
          <button
            type="button"
            class="gc-wp-ctx__btn gc-wp-ctx__btn--primary"
            (click)="emit('set-departure')"
          >
            {{ labels().setDeparture }}
          </button>
        }
        @if (canSetArrival()) {
          <button
            type="button"
            class="gc-wp-ctx__btn gc-wp-ctx__btn--primary"
            (click)="emit('set-arrival')"
          >
            {{ labels().setArrival }}
          </button>
        }
        <button type="button" class="gc-wp-ctx__btn" (click)="emit('set-turnpoint')">
          {{ labels().setTurnpoint }}
        </button>
        <button type="button" class="gc-wp-ctx__btn" (click)="emit('edit')">
          {{ labels().edit }}
        </button>
        @if (inCircuit()) {
          <button type="button" class="gc-wp-ctx__btn" (click)="emit('remove-last')">
            {{ removeLastLabel() }}
          </button>
          @if (circuitCount() > 1) {
            <button type="button" class="gc-wp-ctx__btn gc-wp-ctx__btn--ghost" (click)="emit('remove-all')">
              {{ labels().removeAll }}
            </button>
          }
        }
        <button type="button" class="gc-wp-ctx__btn" (click)="emit('center')">
          {{ labels().center }}
        </button>
        <button
          type="button"
          class="gc-wp-ctx__btn gc-wp-ctx__btn--danger"
          (click)="emit('delete-waypoint')"
        >
          {{ labels().deleteWaypoint }}
        </button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WaypointContextMenuComponent {
  waypoint = input.required<Waypoint>();
  circuitLegs = input.required<CircuitLeg[]>();
  typeLabel = input.required<string>();
  canSetDeparture = input(false);
  canSetArrival = input(false);
  labels = input.required<MapPopupLabels>();

  roleLabel = input.required<(role: CircuitLegRole) => string>();

  action = output<WaypointMapAction>();
  dismissed = output<void>();

  readonly coords = computed(() => {
    const wp = this.waypoint();
    return `${wp.latitude.toFixed(5)}°, ${wp.longitude.toFixed(5)}°`;
  });

  /** Altitude MSL (leg personnalisée > CUP), alignée sur le panneau circuit. */
  readonly elevationLine = computed(() => {
    const wp = this.waypoint();
    const prefix = this.labels().altitude;
    const legs = this.circuitLegs().filter(leg => leg.waypointId === wp.id);
    if (legs.length > 0) {
      const uniqueM = [
        ...new Set(
          legs
            .map(leg => resolveLegElevationM(wp, leg))
            .filter((m): m is number => m != null && Number.isFinite(m))
        )
      ];
      const value =
        uniqueM.length === 0
          ? formatElevationDisplay(undefined)
          : uniqueM.length === 1
            ? formatElevationDisplay(uniqueM[0])
            : uniqueM.map(m => formatElevationDisplay(m)).join(' · ');
      return `${prefix} ${value}`;
    }
    return `${prefix} ${formatElevationDisplay(wp.elevation)}`;
  });

  readonly circuitIndices = computed(() =>
    this.circuitLegs()
      .map((leg, index) => (leg.waypointId === this.waypoint().id ? index + 1 : null))
      .filter((n): n is number => n !== null)
  );

  readonly inCircuit = computed(() => this.circuitIndices().length > 0);
  readonly circuitCount = computed(() => this.circuitIndices().length);

  readonly menuAria = computed(() =>
    this.labels().menuAria.replace('{{name}}', this.waypoint().name)
  );

  readonly circuitLine = computed(() => {
    if (!this.inCircuit()) return null;
    const parts: string[] = [];
    this.circuitLegs().forEach((leg, index) => {
      if (leg.waypointId !== this.waypoint().id) return;
      parts.push(`${index + 1} (${this.roleLabel()(leg.role)})`);
    });
    const detail = parts.join(', ');
    const prefix = this.labels().circuitPrefix;
    const count = this.circuitCount();
    return `${prefix} ${detail}${count > 1 ? ` · ${count}×` : ''}`;
  });

  readonly removeLastLabel = computed(() =>
    this.circuitCount() > 1 ? this.labels().removeLast : this.labels().removeFromCircuit
  );

  emit(action: WaypointMapAction): void {
    this.action.emit(action);
  }
}
