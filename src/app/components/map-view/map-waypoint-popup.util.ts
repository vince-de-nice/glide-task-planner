import { CircuitLeg, CircuitLegRole } from '../../models/circuit.model';
import { Waypoint } from '../../models/waypoint.model';
import { MapPopupLabels } from '../../i18n/display-i18n.util';

export type WaypointMapAction =
  | 'set-departure'
  | 'set-arrival'
  | 'set-turnpoint'
  | 'edit'
  | 'remove-last'
  | 'remove-all'
  | 'center'
  | 'delete-waypoint';

export interface WaypointContextPopupModel {
  waypoint: Waypoint;
  circuitLegs: CircuitLeg[];
  typeLabel: string;
  canSetDeparture: boolean;
  canSetArrival: boolean;
  labels: MapPopupLabels;
  roleLabel: (role: CircuitLegRole) => string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export { waypointTypeLabel } from '../../utils/waypoint-type-display.util';

function actionButton(action: WaypointMapAction, label: string, variant = 'secondary'): string {
  return `<button type="button" class="gc-wp-ctx__btn gc-wp-ctx__btn--${variant}" data-action="${action}">${escapeHtml(label)}</button>`;
}

function formatCircuitRolesForWaypoint(
  legs: CircuitLeg[],
  waypointId: string,
  roleLabel: (role: CircuitLegRole) => string
): string {
  const parts: string[] = [];
  legs.forEach((leg, index) => {
    if (leg.waypointId !== waypointId) return;
    parts.push(`${index + 1} (${roleLabel(leg.role)})`);
  });
  return parts.join(', ');
}

export function buildWaypointContextPopupHtml(model: WaypointContextPopupModel): string {
  const { waypoint, circuitLegs, typeLabel, canSetDeparture, canSetArrival, labels, roleLabel } =
    model;
  const circuitIndices = circuitLegs
    .map((leg, index) => (leg.waypointId === waypoint.id ? index + 1 : null))
    .filter((n): n is number => n !== null);
  const inCircuit = circuitIndices.length > 0;
  const count = circuitIndices.length;
  const coords = `${waypoint.latitude.toFixed(5)}°, ${waypoint.longitude.toFixed(5)}°`;
  const codeLine = waypoint.code
    ? `<p class="gc-wp-ctx__meta">${escapeHtml(waypoint.code)}${waypoint.country ? ` · ${escapeHtml(waypoint.country)}` : ''}</p>`
    : '';

  const roleDetail = inCircuit ? formatCircuitRolesForWaypoint(circuitLegs, waypoint.id, roleLabel) : '';
  const circuitLine = inCircuit
    ? `<p class="gc-wp-ctx__circuit">${escapeHtml(labels.circuitPrefix)} ${escapeHtml(roleDetail)}${count > 1 ? ` · ${count}×` : ''}</p>`
    : '';

  const actions: string[] = [
    ...(canSetDeparture
      ? [actionButton('set-departure', labels.setDeparture, 'primary')]
      : []),
    ...(canSetArrival ? [actionButton('set-arrival', labels.setArrival, 'primary')] : []),
    actionButton('set-turnpoint', labels.setTurnpoint),
    actionButton('edit', labels.edit),
    ...(inCircuit
      ? [
          actionButton(
            'remove-last',
            count > 1 ? labels.removeLast : labels.removeFromCircuit
          ),
          ...(count > 1 ? [actionButton('remove-all', labels.removeAll, 'ghost')] : [])
        ]
      : []),
    actionButton('center', labels.center),
    actionButton('delete-waypoint', labels.deleteWaypoint, 'danger')
  ];

  return `
    <div class="gc-wp-ctx" role="menu" aria-label="${escapeHtml(labels.menuAria.replace('{{name}}', waypoint.name))}">
      <p class="gc-wp-ctx__title"><strong>${escapeHtml(waypoint.name)}</strong></p>
      <p class="gc-wp-ctx__meta">${escapeHtml(typeLabel)}</p>
      ${codeLine}
      <p class="gc-wp-ctx__meta">${coords}</p>
      ${circuitLine}
      <div class="gc-wp-ctx__actions">
        ${actions.join('')}
      </div>
    </div>
  `;
}
