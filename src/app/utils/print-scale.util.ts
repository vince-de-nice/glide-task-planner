/**
 * Mise en page impression A4 à échelle fixe (ex. 1:250 000), nord en haut.
 */
export const PRINT_SCALE_DENOMINATOR = 250_000;
export const PRINT_DPI = 300;

/** A4 en mm. */
export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;

/** Marges papier (hors bandeau métadonnées). */
export const PRINT_MARGIN_MM = 8;
/** Réserve haute pour le bandeau (titre + 4–6 lignes de métadonnées). */
export const PRINT_HEADER_MM = 22;

const METERS_PER_PIXEL_ZOOM_0 = 156543.03;
const M_PER_DEG_LAT = 111_320;

export type PrintPageOrientation = 'portrait' | 'landscape';

export interface GeoBounds {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export interface PrintPageSpec {
  pageIndex: number;
  totalPages: number;
  orientation: PrintPageOrientation;
  center: [number, number];
  zoom: number;
  /** Emprise au sol couverte (m), nord en haut. */
  groundWidthM: number;
  groundHeightM: number;
}

export interface PrintLayoutOptions {
  bounds: GeoBounds;
  /** Bandeau métadonnées en haut de chaque page. */
  includeHeader?: boolean;
  /** Marge autour du circuit pour le mode circuit entier (fraction, ex. 0.05). */
  boundsPaddingFraction?: number;
}

/** mètres par pixel MapLibre à un zoom donné et une latitude. */
export function metersPerPixelAtZoom(latitudeDeg: number, zoom: number): number {
  const latRad = (latitudeDeg * Math.PI) / 180;
  return (METERS_PER_PIXEL_ZOOM_0 * Math.cos(latRad)) / 2 ** zoom;
}

/** Zoom MapLibre pour une échelle nominale et un DPI d'impression. */
export function zoomForFixedScale(
  latitudeDeg: number,
  scaleDenominator: number = PRINT_SCALE_DENOMINATOR,
  dpi: number = PRINT_DPI
): number {
  const metersPerPixel = scaleDenominator * (0.0254 / dpi);
  const latRad = (latitudeDeg * Math.PI) / 180;
  const mpp0 = METERS_PER_PIXEL_ZOOM_0 * Math.cos(latRad);
  return Math.log2(mpp0 / metersPerPixel);
}

/** Fraction de la hauteur utile page (10–60 %). */
export function clampProfileChartHeightPercent(value: unknown): number {
  const fallback = 30;
  const n = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(60, Math.max(10, Math.round(n)));
}

/** Mise en page de la coupe dans le PDF. */
export type ProfileChartPrintLayout = 'withMap' | 'profileOnly' | 'profilesCombined';

/** Hauteur réservée au libellé de branche sur une page multi-coupes (mm). */
export const PROFILE_COMBINED_LABEL_MM = 5;
/** Espace entre deux coupes sur une page multi-coupes (mm). */
export const PROFILE_COMBINED_GAP_MM = 3;

/**
 * Taille d’export PNG de la coupe alignée sur la mise en page PDF.
 *
 * - `withMap` : bandeau en bas de la page (fraction `heightPercent` de la hauteur utile).
 * - `profileOnly` : page dédiée en paysage, coupe sur toute la zone sous le bandeau.
 * - `profilesCombined` : une rangée sur une page multi-coupes (`combinedProfileCount` ≥ 2).
 */
export function profileChartExportPixelSize(params: {
  layout: ProfileChartPrintLayout;
  orientation?: PrintPageOrientation;
  includeHeader: boolean;
  /** Utilisé uniquement pour `layout: 'withMap'`. */
  heightPercent?: number;
  /** Nombre de coupes sur la même page (layout `profilesCombined`). */
  combinedProfileCount?: number;
  dpi?: number;
}): { width: number; height: number } {
  const dpi = params.dpi ?? PRINT_DPI;
  const useLandscape =
    params.layout === 'profileOnly' || params.layout === 'profilesCombined';
  const orientation = useLandscape ? 'landscape' : (params.orientation ?? 'portrait');
  const { widthMm, heightMm } = printableMapSizeMm(orientation, params.includeHeader);
  const width = Math.round((widthMm / 25.4) * dpi);

  if (params.layout === 'profileOnly') {
    return {
      width,
      height: Math.max(240, Math.round((heightMm / 25.4) * dpi))
    };
  }

  if (params.layout === 'profilesCombined') {
    const n = Math.max(1, Math.round(params.combinedProfileCount ?? 1));
    const labelsMm = n * PROFILE_COMBINED_LABEL_MM;
    const gapsMm = Math.max(0, n - 1) * PROFILE_COMBINED_GAP_MM;
    const slotMm = Math.max(40, (heightMm - labelsMm - gapsMm) / n);
    return {
      width,
      height: Math.max(120, Math.round((slotMm / 25.4) * dpi))
    };
  }

  const frac = clampProfileChartHeightPercent(params.heightPercent) / 100;
  return {
    width,
    height: Math.max(240, Math.round((heightMm * frac / 25.4) * dpi))
  };
}

/** Dimensions utiles de la zone carte sur une page (mm). */
export function printableMapSizeMm(
  orientation: PrintPageOrientation,
  includeHeader: boolean
): { widthMm: number; heightMm: number } {
  const pageW = orientation === 'landscape' ? A4_HEIGHT_MM : A4_WIDTH_MM;
  const pageH = orientation === 'landscape' ? A4_WIDTH_MM : A4_HEIGHT_MM;
  const header = includeHeader ? PRINT_HEADER_MM : 0;
  return {
    widthMm: pageW - 2 * PRINT_MARGIN_MM,
    heightMm: pageH - 2 * PRINT_MARGIN_MM - header
  };
}

/** Dimensions pixels de la page complète à l'impression. */
export function pagePixelSize(
  orientation: PrintPageOrientation,
  dpi: number = PRINT_DPI
): { widthPx: number; heightPx: number } {
  const wMm = orientation === 'landscape' ? A4_HEIGHT_MM : A4_WIDTH_MM;
  const hMm = orientation === 'landscape' ? A4_WIDTH_MM : A4_HEIGHT_MM;
  return {
    widthPx: Math.round((wMm / 25.4) * dpi),
    heightPx: Math.round((hMm / 25.4) * dpi)
  };
}

/** Zone carte en pixels (hors marges / bandeau). */
export function mapViewportPixelSize(
  orientation: PrintPageOrientation,
  includeHeader: boolean,
  dpi: number = PRINT_DPI
): { widthPx: number; heightPx: number } {
  const { widthMm, heightMm } = printableMapSizeMm(orientation, includeHeader);
  return {
    widthPx: Math.round((widthMm / 25.4) * dpi),
    heightPx: Math.round((heightMm / 25.4) * dpi)
  };
}

/** Étendue au sol (m) couverte par la zone carte imprimable. */
export function groundSpanMetersPerPage(
  orientation: PrintPageOrientation,
  latitudeDeg: number,
  includeHeader: boolean,
  scaleDenominator: number = PRINT_SCALE_DENOMINATOR,
  dpi: number = PRINT_DPI
): { widthM: number; heightM: number } {
  const { widthMm, heightMm } = printableMapSizeMm(orientation, includeHeader);
  const widthM = (widthMm / 1000) * scaleDenominator;
  const heightM = (heightMm / 1000) * scaleDenominator;
  return { widthM, heightM };
}

export function expandBounds(bounds: GeoBounds, paddingFraction: number): GeoBounds {
  const lngSpan = bounds.maxLng - bounds.minLng;
  const latSpan = bounds.maxLat - bounds.minLat;
  const padLng = Math.max(lngSpan * paddingFraction, 0.002);
  const padLat = Math.max(latSpan * paddingFraction, 0.002);
  return {
    minLng: bounds.minLng - padLng,
    maxLng: bounds.maxLng + padLng,
    minLat: bounds.minLat - padLat,
    maxLat: bounds.maxLat + padLat
  };
}

export function boundsCenter(bounds: GeoBounds): [number, number] {
  return [(bounds.minLng + bounds.maxLng) / 2, (bounds.minLat + bounds.maxLat) / 2];
}

/** Orientation dominante pour une bbox (nord en haut). */
export function orientationForBounds(bounds: GeoBounds): PrintPageOrientation {
  const centerLat = (bounds.minLat + bounds.maxLat) / 2;
  const latRad = (centerLat * Math.PI) / 180;
  const widthM =
    (bounds.maxLng - bounds.minLng) * M_PER_DEG_LAT * Math.cos(latRad);
  const heightM = (bounds.maxLat - bounds.minLat) * M_PER_DEG_LAT;
  return widthM >= heightM ? 'landscape' : 'portrait';
}

/** Découpe une bbox en tuiles de pages à échelle fixe (nord en haut). */
export function buildPrintPageLayout(options: PrintLayoutOptions): PrintPageSpec[] {
  const padding = options.boundsPaddingFraction ?? 0.05;
  const bounds = expandBounds(options.bounds, padding);
  const includeHeader = options.includeHeader !== false;
  const orientation = orientationForBounds(bounds);
  const centerLat = (bounds.minLat + bounds.maxLat) / 2;
  const zoom = zoomForFixedScale(centerLat);
  const { widthM: tileW, heightM: tileH } = groundSpanMetersPerPage(
    orientation,
    centerLat,
    includeHeader
  );

  const latRad = (centerLat * Math.PI) / 180;
  const totalWidthM =
    (bounds.maxLng - bounds.minLng) * M_PER_DEG_LAT * Math.cos(latRad);
  const totalHeightM = (bounds.maxLat - bounds.minLat) * M_PER_DEG_LAT;

  const cols = Math.max(1, Math.ceil(totalWidthM / tileW));
  const rows = Math.max(1, Math.ceil(totalHeightM / tileH));
  const totalPages = cols * rows;

  const westM = bounds.minLng * M_PER_DEG_LAT * Math.cos(latRad);
  const southM = bounds.minLat * M_PER_DEG_LAT;

  const pages: PrintPageSpec[] = [];
  let pageIndex = 0;

  for (let row = rows - 1; row >= 0; row--) {
    for (let col = 0; col < cols; col++) {
      const centerXM = westM + (col + 0.5) * tileW;
      const centerYM = southM + (row + 0.5) * tileH;
      const centerLng = centerXM / (M_PER_DEG_LAT * Math.cos(latRad));
      const centerLatPage = centerYM / M_PER_DEG_LAT;

      pages.push({
        pageIndex,
        totalPages,
        orientation,
        center: [centerLng, centerLatPage],
        zoom,
        groundWidthM: tileW,
        groundHeightM: tileH
      });
      pageIndex++;
    }
  }

  return pages;
}

/** Longueur de barre d'échelle « ronde » en mètres (ex. 5 km à 1:250k). */
export function pickScaleBarMeters(groundWidthM: number): number {
  const candidates = [500, 1_000, 2_000, 5_000, 10_000, 20_000, 50_000];
  const target = groundWidthM * 0.18;
  let best = candidates[0];
  for (const c of candidates) {
    if (c <= target) best = c;
  }
  return best;
}

/** Largeur de la barre d'échelle en mm sur papier. */
export function scaleBarWidthMm(scaleBarMeters: number): number {
  return (scaleBarMeters / PRINT_SCALE_DENOMINATOR) * 1000;
}
