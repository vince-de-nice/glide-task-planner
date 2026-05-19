import { Waypoint } from '../../models/waypoint.model';
import { WAYPOINT_TYPE_DISPLAY } from '../../utils/waypoint-type-display.util';

export type WaypointSortField = 'name' | 'type' | 'latitude' | 'longitude' | 'elevation';

export function filterWaypoints(waypoints: Waypoint[], query: string): Waypoint[] {
  const q = query.trim().toLowerCase();
  if (!q) return waypoints;

  return waypoints.filter(wp => {
    const typeLabel = WAYPOINT_TYPE_DISPLAY[wp.type]?.description ?? wp.type;
    const haystack = [
      wp.name,
      wp.code,
      wp.description,
      wp.country,
      typeLabel,
      wp.type,
      String(wp.latitude),
      String(wp.longitude),
      wp.elevation != null ? String(wp.elevation) : ''
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function sortWaypoints(
  waypoints: Waypoint[],
  field: WaypointSortField,
  direction: 'asc' | 'desc'
): Waypoint[] {
  const mult = direction === 'asc' ? 1 : -1;

  return [...waypoints].sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case 'name':
        cmp = a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
        break;
      case 'type':
        cmp = a.type.localeCompare(b.type);
        if (cmp === 0) {
          cmp = a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
        }
        break;
      case 'latitude':
        cmp = a.latitude - b.latitude;
        break;
      case 'longitude':
        cmp = a.longitude - b.longitude;
        break;
      case 'elevation': {
        const aMissing = a.elevation == null;
        const bMissing = b.elevation == null;
        if (aMissing && bMissing) {
          cmp = 0;
        } else if (aMissing) {
          cmp = 1;
        } else if (bMissing) {
          cmp = -1;
        } else {
          cmp = a.elevation! - b.elevation!;
        }
        break;
      }
    }
    return cmp * mult;
  });
}

export function paginateWaypoints(
  waypoints: Waypoint[],
  page: number,
  pageSize: number
): Waypoint[] {
  const totalPages = Math.max(1, Math.ceil(waypoints.length / pageSize));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const start = (safePage - 1) * pageSize;
  return waypoints.slice(start, start + pageSize);
}
