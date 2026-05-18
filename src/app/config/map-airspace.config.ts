/** Régions POAFF (SIA / vol libre) — licence Ouverte, Pascal Bazile / data.gouv.fr */
export interface PoaffRegion {
  id: string;
  label: string;
  /** Fichier servi en local : public/assets/airspace/ (npm run airspace:fetch) */
  assetFile: string;
}

/** Proxy dev (proxy.conf.json) — contourne le blocage CORS du navigateur */
export const POAFF_PROXY_PREFIX = '/api/poaff/download.php?file=files';

export const POAFF_AIRSPACE_REGIONS: PoaffRegion[] = [
  {
    id: 'geoFrench',
    label: 'France métropolitaine',
    assetFile: '20250417_ff-French.geojson'
  },
  {
    id: 'geoFrenchAlps',
    label: 'Alpes',
    assetFile: '20250417_ff-FrenchAlps.geojson'
  },
  {
    id: 'geoFrenchPyrenees',
    label: 'Pyrénées',
    assetFile: '20250417_ff-FrenchPyrenees.geojson'
  },
  {
    id: 'geoFrenchNorth',
    label: 'Nord',
    assetFile: '20250417_ff-FrenchNorth.geojson'
  },
  {
    id: 'geoFrenchSouth',
    label: 'Sud',
    assetFile: '20250417_ff-FrenchSouth.geojson'
  }
];

export const DEFAULT_POAFF_REGION_ID = 'geoFrench';

export function poaffRegionAssetUrl(region: PoaffRegion): string {
  return `/assets/airspace/${region.assetFile}`;
}

export function poaffRegionProxyUrl(region: PoaffRegion): string {
  return `${POAFF_PROXY_PREFIX}/${region.assetFile}`;
}

export const OPENAIP_TILE_URL =
  'https://api.tiles.openaip.net/api/data/openaip/{z}/{x}/{y}.png';

export const AIRSPACE_ATTRIBUTION =
  'Espaces aériens : <a href="https://www.openaip.net">OpenAIP</a> (CC BY-NC) ou <a href="https://www.data.gouv.fr/fr/datasets/cartographies-aeriennes-dediees-a-la-pratique-du-vol-libre/">POAFF/SIA</a>';
