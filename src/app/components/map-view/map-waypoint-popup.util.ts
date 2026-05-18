import { Waypoint, WaypointType } from '../../models/waypoint.model';

export type WaypointMapAction =
  | 'add-circuit'
  | 'remove-last'
  | 'remove-all'
  | 'center'
  | 'delete-custom';

export interface WaypointContextPopupModel {
  waypoint: Waypoint;
  circuitIndices: number[];
  typeLabel: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function waypointTypeLabel(type: WaypointType): string {
  switch (type) {
    case 'airfield':
      return 'Aérodrome';
    case 'landable':
      return 'Posé possible';
    case 'custom':
      return 'Point personnalisé';
    default:
      return 'Point de virage';
  }
}

function actionButton(action: WaypointMapAction, label: string, variant = 'secondary'): string {
  return `<button type="button" class="vav-wp-ctx__btn vav-wp-ctx__btn--${variant}" data-action="${action}">${escapeHtml(label)}</button>`;
}

export function buildWaypointContextPopupHtml(model: WaypointContextPopupModel): string {
  const { waypoint, circuitIndices, typeLabel } = model;
  const inCircuit = circuitIndices.length > 0;
  const count = circuitIndices.length;
  const coords = `${waypoint.latitude.toFixed(5)}°, ${waypoint.longitude.toFixed(5)}°`;
  const codeLine = waypoint.code
    ? `<p class="vav-wp-ctx__meta">${escapeHtml(waypoint.code)}${waypoint.country ? ` · ${escapeHtml(waypoint.country)}` : ''}</p>`
    : '';

  const circuitLine = inCircuit
    ? `<p class="vav-wp-ctx__circuit">Circuit : positions ${circuitIndices.join(', ')}${count > 1 ? ` (${count}×)` : ''}</p>`
    : '';

  const actions: string[] = [
    actionButton('add-circuit', 'Ajouter au circuit', 'primary'),
    ...(inCircuit
      ? [
          actionButton(
            'remove-last',
            count > 1 ? 'Retirer la dernière occurrence' : 'Retirer du circuit'
          ),
          ...(count > 1
            ? [actionButton('remove-all', 'Retirer toutes les occurrences', 'ghost')]
            : [])
        ]
      : []),
    actionButton('center', 'Centrer sur la carte'),
    ...(waypoint.type === 'custom'
      ? [actionButton('delete-custom', 'Supprimer ce point', 'danger')]
      : [])
  ];

  return `
    <div class="vav-wp-ctx" role="menu" aria-label="Actions sur ${escapeHtml(waypoint.name)}">
      <p class="vav-wp-ctx__title"><strong>${escapeHtml(waypoint.name)}</strong></p>
      <p class="vav-wp-ctx__meta">${escapeHtml(typeLabel)}</p>
      ${codeLine}
      <p class="vav-wp-ctx__meta">${coords}</p>
      ${circuitLine}
      <div class="vav-wp-ctx__actions">
        ${actions.join('')}
      </div>
    </div>
  `;
}
