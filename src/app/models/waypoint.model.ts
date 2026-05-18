export type WaypointType = 'turnpoint' | 'airfield' | 'landable' | 'custom';

export interface Waypoint {
  id: string;
  name: string;
  code?: string;
  country?: string;
  latitude: number;
  longitude: number;
  elevation?: number;
  description?: string;
  type: WaypointType;
}

export type WaypointTypeFilter = 'all' | WaypointType;
