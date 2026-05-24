import { Injectable, inject } from '@angular/core';
import { Map as MaplibreMap, type GeoJSONSource, type StyleSpecification } from 'maplibre-gl';
import {
  applyBasemapToMap,
  buildBaseMapStyle,
  MAP_SOURCE,
  type BasemapId
} from '../components/map-view/map-style.constants';
import { configureMapFreeCamera } from '../utils/map-free-camera.util';
import { ensureMapterhornGrayProtocolRegistered } from '../utils/map-basemap.util';
import { isMapStyleActive } from '../utils/map-runtime.util';
import {
  installSafetyProfileMapLayers,
  PROFILE_MAP_LAYER,
  PROFILE_MAP_SOURCE,
  repositionProfileMapLayers,
  SAFETY_PROFILE_EMPTY_FC,
  type SafetyProfileMapLayers
} from '../utils/safety-profile-map-layers.util';
import type { SafetyPrintOptions } from '../models/safety-print-options.model';
import type { SafetyLegRender } from './safety-profile-terrain.facade';
import type { Waypoint } from '../models/waypoint.model';
import type { CircuitLeg } from '../models/circuit.model';
import {
  buildBranchLinesGeoJson,
  buildConeSpecsForLeg,
  buildLegPointsGeoJsonForRender,
  buildMap3dLabelSpecsForLeg,
  buildSafetyMinAltitudePath
} from '../utils/safety-profile-map-render.util';
import {
  mapViewportPixelSize,
  type PrintPageSpec
} from '../utils/print-scale.util';
import { projectMap3dLabelsToScreen, type Map3dLabelSpec } from '../utils/map-3d-labels.util';
import { AirspaceMapDisplayService } from './airspace-map-display.service';
export interface PrintMapRenderContext {
  options: SafetyPrintOptions;
  legRenders: SafetyLegRender[];
  legPairs: { from: Waypoint; to: Waypoint }[];
  circuitLegs: CircuitLeg[];
  glideRatio: number;
  /** Branche mise en avant (carte / cônes) ; null = toutes visibles pareil. */
  focusLegIndex: number | null;
  getWaypoint: (id: string) => Waypoint | undefined;
  enabledAirspaceKeysForLeg: (legIndex: number) => Set<string>;
}

const MAP_IDLE_TIMEOUT_MS = 45_000;

@Injectable({ providedIn: 'root' })
export class SafetyPrintMapRendererService {
  private readonly airspaceMapDisplay = inject(AirspaceMapDisplayService);

  private container: HTMLDivElement | null = null;
  private map: MaplibreMap | null = null;
  private layers: SafetyProfileMapLayers | null = null;
  private basemapId: BasemapId | null = null;

  async ensureMap(basemapId: BasemapId): Promise<MaplibreMap> {
    ensureMapterhornGrayProtocolRegistered();
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.style.cssText =
        'position:fixed;left:-10000px;top:0;overflow:hidden;pointer-events:none;';
      document.body.appendChild(this.container);
    }

    if (this.map && this.basemapId !== basemapId) {
      this.destroyMap();
    }

    if (!this.map) {
      const style = buildBaseMapStyle(basemapId) as StyleSpecification;
      this.map = new MaplibreMap({
        container: this.container,
        style,
        center: [5, 44],
        zoom: 10,
        bearing: 0,
        pitch: 0,
        interactive: false,
        fadeDuration: 0,
        attributionControl: false
      });
      await this.waitForLoad(this.map);
      configureMapFreeCamera(this.map);
      if (!this.map.getTerrain()) {
        this.map.setTerrain({ source: MAP_SOURCE.TERRAIN_DEM, exaggeration: 1 });
      }
      this.layers = installSafetyProfileMapLayers(this.map);
      this.basemapId = basemapId;
    }

    return this.map;
  }

  destroyMap(): void {
    if (this.map) {
      this.airspaceMapDisplay.invalidateAndClearFromMap(this.map);
      this.map.remove();
      this.map = null;
      this.layers = null;
      this.basemapId = null;
    }
  }

  dispose(): void {
    this.destroyMap();
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }

  async renderPage(
    page: PrintPageSpec,
    ctx: PrintMapRenderContext
  ): Promise<string> {
    const map = await this.ensureMap(ctx.options.basemapId);
    const { widthPx, heightPx } = mapViewportPixelSize(
      page.orientation,
      ctx.options.includeMetadata
    );
    this.container!.style.width = `${widthPx}px`;
    this.container!.style.height = `${heightPx}px`;
    map.resize();

    map.jumpTo({
      center: page.center,
      zoom: page.zoom,
      bearing: 0,
      pitch: 0
    });

    await this.applyMapData(map, ctx);
    await this.waitForIdle(map);
    await this.waitFrames(2);
    map.triggerRepaint();
    await this.waitFrames(1);

    let dataUrl = map.getCanvas().toDataURL('image/png');
    const labelSpecs = this.collectLabelSpecs(ctx);
    if (ctx.options.map3dLabels && labelSpecs.length > 0) {
      dataUrl = await this.composeLabels(dataUrl, map, labelSpecs, widthPx, heightPx);
    }
    return dataUrl;
  }

  private async applyMapData(map: MaplibreMap, ctx: PrintMapRenderContext): Promise<void> {
    const { options, focusLegIndex } = ctx;
    const layers = this.layers!;

    const pairs = ctx.legPairs;
    if (options.branchLines) {
      const branchFc = buildBranchLinesGeoJson(pairs, focusLegIndex);
      (map.getSource(PROFILE_MAP_SOURCE.BRANCHES) as GeoJSONSource)?.setData(branchFc);
    } else {
      (map.getSource(PROFILE_MAP_SOURCE.BRANCHES) as GeoJSONSource)?.setData(
        SAFETY_PROFILE_EMPTY_FC
      );
    }

    const activeLeg =
      focusLegIndex != null
        ? ctx.legRenders.find(l => l.index === focusLegIndex)
        : null;

    if (options.waypoints && activeLeg) {
      const pts = buildLegPointsGeoJsonForRender(activeLeg, ctx.getWaypoint);
      (map.getSource(PROFILE_MAP_SOURCE.POINTS) as GeoJSONSource)?.setData(pts);
    } else if (options.waypoints && focusLegIndex == null) {
      const allPoints = ctx.legRenders.flatMap(leg =>
        buildLegPointsGeoJsonForRender(leg, ctx.getWaypoint).features
      );
      (map.getSource(PROFILE_MAP_SOURCE.POINTS) as GeoJSONSource)?.setData({
        type: 'FeatureCollection',
        features: allPoints
      });
    } else {
      (map.getSource(PROFILE_MAP_SOURCE.POINTS) as GeoJSONSource)?.setData(
        SAFETY_PROFILE_EMPTY_FC
      );
    }

    (map.getSource(PROFILE_MAP_SOURCE.LANDABLE_HIGHLIGHT) as GeoJSONSource)?.setData(
      SAFETY_PROFILE_EMPTY_FC
    );

    const coneLeg = activeLeg ?? ctx.legRenders[0];
    const showCones =
      coneLeg &&
      (options.coneVolumes3d || options.coneDistanceRings);
    if (showCones && coneLeg) {
      const specs = buildConeSpecsForLeg(coneLeg, ctx.glideRatio, ctx.getWaypoint);
      layers.safetyConesLayer.setSpecs(specs);
      layers.safetyConesLayer.setPartVisibility(
        options.coneVolumes3d,
        options.coneDistanceRings
      );
      layers.safetyConesLayer.setVisible(specs.length > 0);
    } else {
      layers.safetyConesLayer.setSpecs([]);
      layers.safetyConesLayer.setVisible(false);
    }

    if (activeLeg && options.safetyMinAltitudeRibbon) {
      const path = buildSafetyMinAltitudePath(activeLeg.envelope.samples);
      layers.safetyMinAltitudeLayer.setPath(path);
      layers.safetyMinAltitudeLayer.setVisible(path.length >= 2);
      const coneSpecs = showCones
        ? buildConeSpecsForLeg(activeLeg, ctx.glideRatio, ctx.getWaypoint)
        : [];
      layers.safetyMinAltitudeLayer.setCrossingLabels(
        options.map3dLabels
          ? buildMap3dLabelSpecsForLeg(
              activeLeg,
              coneSpecs,
              options.coneDistanceRings,
              true
            )
          : []
      );
    } else {
      layers.safetyMinAltitudeLayer.setPath([]);
      layers.safetyMinAltitudeLayer.setVisible(false);
      layers.safetyMinAltitudeLayer.setCrossingLabels([]);
    }

    if (options.airspace3d && focusLegIndex != null) {
      await this.airspaceMapDisplay.ensureEnrichedCache(map, 'safety-profile');
      if (isMapStyleActive(map)) {
        const keys = ctx.enabledAirspaceKeysForLeg(focusLegIndex);
        await this.airspaceMapDisplay.applyLegZonesToMap(
          map,
          'safety-profile',
          PROFILE_MAP_LAYER.POINTS,
          keys
        );
      }
    } else if (options.airspace3d && focusLegIndex == null) {
      await this.airspaceMapDisplay.ensureEnrichedCache(map, 'safety-profile');
      const allKeys = new Set<string>();
      for (let i = 0; i < ctx.legRenders.length; i++) {
        for (const k of ctx.enabledAirspaceKeysForLeg(i)) allKeys.add(k);
      }
      if (isMapStyleActive(map)) {
        await this.airspaceMapDisplay.applyLegZonesToMap(
          map,
          'safety-profile',
          PROFILE_MAP_LAYER.POINTS,
          allKeys
        );
      }
    }

    repositionProfileMapLayers(map);
    map.triggerRepaint();
  }

  private collectLabelSpecs(ctx: PrintMapRenderContext): Map3dLabelSpec[] {
    if (!ctx.options.map3dLabels) return [];
    const focus =
      ctx.focusLegIndex != null
        ? ctx.legRenders.find(l => l.index === ctx.focusLegIndex)
        : null;
    if (!focus) return [];
    const coneSpecs = buildConeSpecsForLeg(focus, ctx.glideRatio, ctx.getWaypoint);
    return buildMap3dLabelSpecsForLeg(
      focus,
      coneSpecs,
      ctx.options.coneDistanceRings,
      true
    );
  }

  private async composeLabels(
    mapDataUrl: string,
    map: MaplibreMap,
    specs: Map3dLabelSpec[],
    widthPx: number,
    heightPx: number
  ): Promise<string> {
    const matrix =
      this.layers?.safetyMinAltitudeLayer.getLastProjectionMatrix() ??
      this.layers?.safetyConesLayer.getLastProjectionMatrix();
    if (!matrix) return mapDataUrl;

    const screens = projectMap3dLabelsToScreen(specs, matrix, map.getCanvas());
    const canvas = document.createElement('canvas');
    canvas.width = widthPx;
    canvas.height = heightPx;
    const g = canvas.getContext('2d');
    if (!g) return mapDataUrl;

    const img = await loadImage(mapDataUrl);
    g.drawImage(img, 0, 0, widthPx, heightPx);
    g.font = 'bold 11px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const s of screens) {
      g.strokeStyle = '#ffffff';
      g.lineWidth = 3;
      g.strokeText(s.label, s.x, s.y);
      g.fillStyle = s.color;
      g.fillText(s.label, s.x, s.y);
    }
    return canvas.toDataURL('image/png');
  }

  private waitForLoad(map: MaplibreMap): Promise<void> {
    if (map.loaded()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('print map load timeout')), MAP_IDLE_TIMEOUT_MS);
      map.once('load', () => {
        clearTimeout(t);
        resolve();
      });
    });
  }

  private waitForIdle(map: MaplibreMap): Promise<void> {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('print map idle timeout')), MAP_IDLE_TIMEOUT_MS);
      map.once('idle', () => {
        clearTimeout(t);
        resolve();
      });
    });
  }

  private waitFrames(n: number): Promise<void> {
    return new Promise(resolve => {
      let left = n;
      const step = () => {
        left--;
        if (left <= 0) resolve();
        else requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}
