/** SeeYou CUP : DDMM.mmmN / DDDMM.mmmE (3 décimales de minutes). */
export function formatSeeYouLatitude(latitude: number): string {
  return formatSeeYouCoordinate(latitude, 'lat');
}

export function formatSeeYouLongitude(longitude: number): string {
  return formatSeeYouCoordinate(longitude, 'lon');
}

function formatSeeYouCoordinate(value: number, kind: 'lat' | 'lon'): string {
  const hemisphere =
    kind === 'lat' ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W';
  const abs = Math.abs(value);
  const degreeDigits = kind === 'lat' ? 2 : 3;
  const degrees = Math.floor(abs);
  const minutes = (abs - degrees) * 60;
  const degStr = String(degrees).padStart(degreeDigits, '0');
  const minStr = minutes.toFixed(3).padStart(6, '0');
  return `${degStr}${minStr}${hemisphere}`;
}

/**
 * IGC C-record (FAI A3.5.4) : DD MM mmmN / DDD MM mmmE avec espaces.
 * Ex. 51 11 359N 001 01 899W
 */
export function formatIgcLatitude(latitude: number): string {
  return formatIgcCoordinate(latitude, 'lat');
}

export function formatIgcLongitude(longitude: number): string {
  return formatIgcCoordinate(longitude, 'lon');
}

function formatIgcCoordinate(value: number, kind: 'lat' | 'lon'): string {
  const hemisphere =
    kind === 'lat' ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W';
  const abs = Math.abs(value);
  const degreeDigits = kind === 'lat' ? 2 : 3;
  const degrees = Math.floor(abs);
  const minutesTotal = (abs - degrees) * 60;
  const minutes = Math.floor(minutesTotal);
  const thousandths = Math.round((minutesTotal - minutes) * 1000);
  const degStr = String(degrees).padStart(degreeDigits, '0');
  const minStr = String(minutes).padStart(2, '0');
  const fracStr = String(thousandths).padStart(3, '0');
  return `${degStr} ${minStr} ${fracStr}${hemisphere}`;
}

export const IGC_ZERO_COORD = '0000000N 00000000E';

export function isValidLatitude(lat: number): boolean {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90;
}

export function isValidLongitude(lon: number): boolean {
  return Number.isFinite(lon) && lon >= -180 && lon <= 180;
}
