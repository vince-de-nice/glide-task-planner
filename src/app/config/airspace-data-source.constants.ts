export const AIRSPACE_ACTIVE_SOURCE_KEY = 'gc-airspace-active-source-id';
export const AIRSPACE_CUSTOM_CATALOG_KEY = 'gc-airspace-custom-catalog';
export const AIRSPACE_CUSTOM_IDB_NAME = 'gc-airspace-custom';
export const AIRSPACE_CUSTOM_IDB_STORE = 'geojson';
export const CUSTOM_AIRSPACE_ID_PREFIX = 'custom:';

export function isCustomAirspaceSourceId(sourceId: string): boolean {
  return sourceId.startsWith(CUSTOM_AIRSPACE_ID_PREFIX);
}

export function newCustomAirspaceSourceId(): string {
  return `${CUSTOM_AIRSPACE_ID_PREFIX}${crypto.randomUUID()}`;
}
