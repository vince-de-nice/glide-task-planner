import { CircuitLeg } from './circuit.model';
import { Waypoint } from './waypoint.model';
import { ObsZonePreviewView } from '../utils/obs-zone-preview.util';

/** Élément affiché dans la liste réordonnable du circuit. */
export interface CircuitListItem {
  leg: CircuitLeg;
  waypoint: Waypoint;
  /** Index réel dans circuitLegs() — stable même si flatMap filtre. */
  legIndex: number;
  /** Aperçu SVG pré-calculé (null si pas de waypoint/zone). */
  previewView: ObsZonePreviewView | null;
  /** Clé unique pour @for track (même waypoint peut apparaître plusieurs fois). */
  key: string;
}
