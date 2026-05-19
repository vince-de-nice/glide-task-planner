import { CircuitLegRole } from '../models/circuit.model';
import { WaypointType } from '../models/waypoint.model';
import { ObsZonePresetId } from '../models/observation-zone.model';
import {
  WAYPOINT_TYPE_DISPLAY,
  WaypointTypeDisplay
} from '../utils/waypoint-type-display.util';
import { TranslateService } from './translate.service';

export function circuitRoleShortLabelI18n(
  role: CircuitLegRole,
  i18n: TranslateService
): string {
  return i18n.t(`circuit.role.${role}`);
}

export function circuitRoleLabelI18n(role: CircuitLegRole, i18n: TranslateService): string {
  if (role === 'turnpoint') {
    return i18n.t('circuit.role.turnpointLong');
  }
  return i18n.t(`circuit.role.${role}`);
}

export function waypointTypeDisplayI18n(
  type: WaypointType,
  i18n: TranslateService
): WaypointTypeDisplay {
  const base = WAYPOINT_TYPE_DISPLAY[type];
  return {
    ...base,
    label: i18n.t(`wpType.${type}.label`),
    description: i18n.t(`wpType.${type}.description`),
    shortLabel: i18n.t(`wpType.${type}.shortLabel`)
  };
}

export function obsZonePresetLabelI18n(id: ObsZonePresetId, i18n: TranslateService): string {
  return i18n.t(`zonePreset.${id}.label`);
}

export function obsZonePresetDescriptionI18n(id: ObsZonePresetId, i18n: TranslateService): string {
  return i18n.t(`zonePreset.${id}.description`);
}

export interface MapPopupLabels {
  circuitPrefix: string;
  setDeparture: string;
  setArrival: string;
  setTurnpoint: string;
  edit: string;
  removeLast: string;
  removeFromCircuit: string;
  removeAll: string;
  center: string;
  deleteWaypoint: string;
  menuAria: string;
}

export function mapPopupLabels(i18n: TranslateService): MapPopupLabels {
  return {
    circuitPrefix: i18n.t('mapPopup.circuitPrefix'),
    setDeparture: i18n.t('mapActions.setDeparture'),
    setArrival: i18n.t('mapActions.setArrival'),
    setTurnpoint: i18n.t('mapPopup.setTurnpoint'),
    edit: i18n.t('common.modify'),
    removeLast: i18n.t('mapPopup.removeLast'),
    removeFromCircuit: i18n.t('mapPopup.removeFromCircuit'),
    removeAll: i18n.t('mapPopup.removeAll'),
    center: i18n.t('mapPopup.center'),
    deleteWaypoint: i18n.t('mapPopup.deleteWaypoint'),
    menuAria: i18n.t('mapPopup.menuAria')
  };
}
