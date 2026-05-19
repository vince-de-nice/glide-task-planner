import { WaypointType } from '../../models/waypoint.model';
import { waypointTypeColor } from '../../utils/waypoint-type-display.util';

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
  return waypointTypeColor(type);
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

/** Estime la taille du divIcon Leaflet (pastille + texte cliquable). */
export function estimateMapLabelSize(name: string, suffix: string | null): [number, number] {
  const charCount = name.length + (suffix?.length ?? 0);
  const textWidth = Math.min(Math.max(0, charCount * 5.5), 210);
  const width = Math.max(6, 8 + textWidth);
  return [width, 14];
}
