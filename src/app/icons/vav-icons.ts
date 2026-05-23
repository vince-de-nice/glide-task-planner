/**
 * VavIcons — icônes métier vol à voile (police complémentaire à PrimeIcons).
 * Classes CSS : `pi pi-vav-<id>` — régénérer via `npm run icons:build`.
 */
export const VavIcons = {
  NAV_CIRCUIT: 'pi pi-vav-nav-circuit',
  NAV_WAYPOINTS: 'pi pi-vav-nav-waypoints',
  NAV_DATA_SOURCES: 'pi pi-vav-nav-data-sources',
  NAV_LIBRARY: 'pi pi-vav-nav-library',
  NAV_SAFETY_PROFILE: 'pi pi-vav-nav-safety-profile',
  NAV_AIRSPACE_DEBUG: 'pi pi-vav-nav-airspace-debug',

  TURNPOINT: 'pi pi-vav-turnpoint',
  AIRFIELD: 'pi pi-vav-airfield',
  LANDABLE: 'pi pi-vav-landable',

  WAYPOINT_CATALOG: 'pi pi-vav-waypoint-catalog',
  WAYPOINT_CATALOG_OFF: 'pi pi-vav-waypoint-catalog-off',

  HILLSHADE: 'pi pi-vav-hillshade',
  AIRSPACE: 'pi pi-vav-airspace',
  AIRSPACE_VOLUME: 'pi pi-vav-airspace-volume',
  AIRSPACE_FILTER: 'pi pi-vav-airspace-filter',
  GLIDE_CONE: 'pi pi-vav-glide-cone',

  BASEMAP_SATELLITE: 'pi pi-vav-basemap-satellite',
  BASEMAP_TOPO: 'pi pi-vav-basemap-topo',
  BASEMAP_OSM: 'pi pi-vav-basemap-osm',
  BASEMAP_CARTO_VOYAGER: 'pi pi-vav-basemap-carto-voyager',
  BASEMAP_CARTO_LIGHT: 'pi pi-vav-basemap-carto-light',
  BASEMAP_OPENTOPO: 'pi pi-vav-basemap-opentopo',
  BASEMAP_DEM_GRAY: 'pi pi-vav-basemap-dem-gray',

  EXPORT_FLARM: 'pi pi-vav-export-flarm',
  EXPORT_CUP: 'pi pi-vav-export-cup',
  EXPORT_CUPX: 'pi pi-vav-export-cupx',
  EXPORT_XCSOAR: 'pi pi-vav-export-xcsoar',
  EXPORT_IGC: 'pi pi-vav-export-igc',

  LOAD_CIRCUIT: 'pi pi-vav-load-circuit',
  CIRCUITS_LIBRARY: 'pi pi-vav-circuits-library',
  REGULATION: 'pi pi-vav-regulation',
  EXPORT_PREVIEW: 'pi pi-vav-export-preview',
  CUP_SOURCE: 'pi pi-vav-cup-source'
} as const;

export type VavIconClass = (typeof VavIcons)[keyof typeof VavIcons];
