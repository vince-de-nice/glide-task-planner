export type WaypointType = 'turnpoint' | 'airfield' | 'landable' | 'custom';

/** Champs CUP SeeYou conservés pour l'export. */
export interface WaypointCupFields {
  style: string;
  rwdir?: string;
  rwlen?: string;
  rwwidth?: string;
  freq?: string;
  userdata?: string;
  pics?: string;
}

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
  cupFields?: WaypointCupFields;
}

export type WaypointTypeFilter = 'all' | WaypointType;
