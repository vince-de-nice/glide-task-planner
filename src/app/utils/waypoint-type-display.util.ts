import { WaypointType } from '../models/waypoint.model';

/** Affichage unifié d’un type de waypoint (carte, liste, filtres). */
export interface WaypointTypeDisplay {
  type: WaypointType;
  /** Libellé court pour filtres / badges */
  label: string;
  /** Libellé long (popup, info) */
  description: string;
  /** Abréviation (TP, AD, AL, P) */
  shortLabel: string;
  color: string;
  icon: string;
}

export const WAYPOINT_TYPE_ORDER: WaypointType[] = [
  'turnpoint',
  'airfield',
  'landable',
  'custom'
];

export const WAYPOINT_TYPE_DISPLAY: Record<WaypointType, WaypointTypeDisplay> = {
  turnpoint: {
    type: 'turnpoint',
    label: 'Turnpoints',
    description: 'Point de virage',
    shortLabel: 'TP',
    color: '#ea580c',
    icon: 'pi pi-flag'
  },
  airfield: {
    type: 'airfield',
    label: 'Aérodromes',
    description: 'Aérodrome',
    shortLabel: 'AD',
    color: '#2563eb',
    icon: 'pi pi-building'
  },
  landable: {
    type: 'landable',
    label: 'Atterrissables',
    description: 'Posé possible',
    shortLabel: 'AL',
    color: '#16a34a',
    icon: 'pi pi-map-marker'
  },
  custom: {
    type: 'custom',
    label: 'Perso',
    description: 'Point personnalisé',
    shortLabel: 'P',
    color: '#9333ea',
    icon: 'pi pi-star'
  }
};

export function waypointTypeDisplay(type: WaypointType): WaypointTypeDisplay {
  return WAYPOINT_TYPE_DISPLAY[type];
}

export function waypointTypeLabel(type: WaypointType): string {
  return WAYPOINT_TYPE_DISPLAY[type].description;
}

export function waypointTypeShortLabel(type: WaypointType): string {
  return WAYPOINT_TYPE_DISPLAY[type].shortLabel;
}

export function waypointTypeColor(type: WaypointType): string {
  return WAYPOINT_TYPE_DISPLAY[type].color;
}

export function waypointTypeMapFilters(): WaypointTypeDisplay[] {
  return WAYPOINT_TYPE_ORDER.map(t => WAYPOINT_TYPE_DISPLAY[t]);
}
