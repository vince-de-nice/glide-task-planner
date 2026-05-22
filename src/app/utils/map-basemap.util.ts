import { registerMapterhornGrayTileProtocol } from './mapterhorn-gray-tile-protocol.util';

let basemapProtocolRegistered = false;

/** Enregistre le protocole tuiles DEM gris (carte principale + profil sécurité). */
export function ensureMapterhornGrayProtocolRegistered(): void {
  if (basemapProtocolRegistered) return;
  basemapProtocolRegistered = true;
  registerMapterhornGrayTileProtocol();
}
