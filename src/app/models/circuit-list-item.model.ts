import { CircuitLeg } from './circuit.model';
import { Waypoint } from './waypoint.model';

/** Élément affiché dans la liste réordonnable du circuit. */
export interface CircuitListItem {
  leg: CircuitLeg;
  waypoint: Waypoint;
  /** Clé unique pour p-orderList (même waypoint peut apparaître plusieurs fois). */
  key: string;
}
