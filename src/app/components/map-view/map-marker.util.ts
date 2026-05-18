import { WaypointType } from '../../models/waypoint.model';

export interface MapMarkerViewModel {
  name: string;
  type: WaypointType;
  /** Ex. "(2,6,9)" ou "(decollage, atterrissage)" — sans fond, texte seul */
  suffix: string | null;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function markerAccentColor(type: WaypointType): string {
  switch (type) {
    case 'airfield':
      return '#2563eb';
    case 'landable':
      return '#16a34a';
    case 'custom':
      return '#9333ea';
    default:
      return '#ea580c';
  }
}

/** Rôles aérodrome affichés sur la carte : decollage, atterrissage */
export function formatMapRoleSuffix(labels: string[]): string {
  const parts = labels.map(label =>
    label === 'Décollage' ? 'decollage' : label === 'Atterrissage' ? 'atterrissage' : label.toLowerCase()
  );
  return `(${parts.join(', ')})`;
}

export function buildMapMarkerHtml(model: MapMarkerViewModel): string {
  const color = markerAccentColor(model.type);
  const name = escapeHtml(model.name);
  const suffix = model.suffix ? ` ${escapeHtml(model.suffix)}` : '';

  return `
    <div class="vav-map-label" style="--map-accent:${color}">
      <span class="vav-map-label__dot" aria-hidden="true"></span>
      <span class="vav-map-label__text">${name}${suffix}</span>
    </div>
  `;
}

/** Estime la taille du divIcon Leaflet pour un libellé texte. */
export function estimateMapLabelSize(name: string, suffix: string | null): [number, number] {
  const charCount = name.length + (suffix?.length ?? 0);
  const width = Math.min(Math.max(48, charCount * 5.5 + 14), 220);
  return [width, 14];
}
