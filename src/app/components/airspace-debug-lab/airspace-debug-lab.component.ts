import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapComponent } from '@maplibre/ngx-maplibre-gl';
import {
  Popup,
  type LngLatBoundsLike,
  type Map as MaplibreMap,
  type StyleSpecification
} from 'maplibre-gl';
import type { FeatureCollection, Geometry } from 'geojson';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import { Slider } from 'primeng/slider';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { TranslateService } from '../../i18n/translate.service';
import {
  applyAirspaceLayersToMap,
  removeAirspaceLayersFromMap
} from '../../utils/airspace-map-layers.util';
import {
  AIRSPACE_DEBUG_GRID_CENTER,
  buildAirspaceDebugFeatureCollection,
  buildAirspaceDebugScenarios,
  buildAirspaceDebugSubsetCollection,
  enrichAirspaceDebugCollection,
  relocateAirspaceDebugScenarios,
  scenarioLngLatBounds,
  type AirspaceDebugScenario
} from '../../utils/airspace-debug-fixtures.util';
import { buildAirspaceWireframeSpecs } from '../../utils/airspace-wireframe.util';
import {
  configureMapFreeCamera,
  MAP_FREE_CAMERA_MAX_PITCH
} from '../../utils/map-free-camera.util';
import { ensureMapterhornGrayProtocolRegistered } from '../../utils/map-basemap.util';
import {
  applyBasemapToMap,
  BASEMAP_PRESETS,
  buildBaseMapStyle,
  DEFAULT_BASEMAP_ID,
  MAP_LAYER,
  setTerrainHillshadeVisible,
  type BasemapId
} from '../map-view/map-style.constants';
import {
  AirspaceLayerService,
  type AirspaceLoadResult,
  type PoaffProperties
} from '../../services/airspace-layer.service';
import type { Feature } from 'geojson';
import type { AirspaceVolumeProperties } from '../../utils/airspace-volume-enrich.util';

const DEBUG_AIRSPACE_RESULT: AirspaceLoadResult = {
  source: 'poaff',
  label: 'Debug — zones fictives'
};

@Component({
  selector: 'app-airspace-debug-lab',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MapComponent,
    Button,
    Select,
    Slider,
    ToggleSwitch,
    TranslatePipe
  ],
  templateUrl: './airspace-debug-lab.component.html',
  styleUrl: './airspace-debug-lab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AirspaceDebugLabComponent implements OnDestroy {
  private readonly i18n = inject(TranslateService);
  private readonly airspaceLayer = inject(AirspaceLayerService);

  readonly scenarios = signal(buildAirspaceDebugScenarios());
  readonly gridAnchor = signal<[number, number]>([...AIRSPACE_DEBUG_GRID_CENTER]);
  readonly debugGridCenter = this.gridAnchor;

  readonly basemapOptions = computed(() => {
    this.i18n.locale();
    return BASEMAP_PRESETS.map(p => ({
      id: p.id,
      label: this.i18n.t(p.labelKey)
    }));
  });

  mapStyle = signal<StyleSpecification>(
    buildBaseMapStyle(DEFAULT_BASEMAP_ID, true)
  );
  basemapId = signal<BasemapId>(DEFAULT_BASEMAP_ID);
  hillshadeVisible = signal(true);
  volume3d = signal(true);
  useDemGround = signal(true);
  showAllZones = signal(true);
  selectedScenarioId = signal<string | null>(null);

  pitch = signal(62);
  bearing = signal(-28);
  zoom = signal(12.4);

  mapReady = signal(false);
  applying = signal(false);
  statusLine = signal('');
  volumeCount = signal(0);
  wireframeCount = signal(0);

  readonly activeScenario = computed(() => {
    const id = this.selectedScenarioId();
    if (!id) return null;
    return this.scenarios().find(s => s.id === id) ?? null;
  });

  readonly anchorLabel = computed(() => {
    const [lng, lat] = this.gridAnchor();
    return `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
  });

  readonly categoryLabel = (cat: AirspaceDebugScenario['category']): string =>
    this.i18n.t(`airspaceDebug.category.${cat}`);

  private map: MaplibreMap | null = null;
  constructor() {
    ensureMapterhornGrayProtocolRegistered();
  }

  ngOnDestroy(): void {
    if (this.map) {
      removeAirspaceLayersFromMap(this.map);
    }
  }

  onMapLoad(map: MaplibreMap): void {
    this.map = map;
    configureMapFreeCamera(map);
    this.syncCameraFromMap();
    this.mapReady.set(true);
    void this.refreshLayers().then(() => this.focusGrid());
  }

  onMapMove(): void {
    if (!this.map) return;
    this.pitch.set(Math.round(this.map.getPitch()));
    this.bearing.set(Math.round(this.map.getBearing()));
    this.zoom.set(Math.round(this.map.getZoom() * 10) / 10);
  }

  async onBasemapChange(id: BasemapId): Promise<void> {
    this.basemapId.set(id);
    const map = this.map;
    if (!map) {
      this.mapStyle.set(buildBaseMapStyle(id, this.hillshadeVisible()));
      return;
    }
    const before = this.firstOverlayLayerId(map);
    applyBasemapToMap(map, id, before);
    setTerrainHillshadeVisible(map, this.hillshadeVisible());
    await this.refreshLayers();
  }

  onHillshadeChange(visible: boolean): void {
    this.hillshadeVisible.set(visible);
    const map = this.map;
    if (map) {
      setTerrainHillshadeVisible(map, visible);
    } else {
      this.mapStyle.set(buildBaseMapStyle(this.basemapId(), visible));
    }
  }

  async onDisplayOptionChange(): Promise<void> {
    await this.refreshLayers();
  }

  selectScenario(scenario: AirspaceDebugScenario): void {
    this.selectedScenarioId.set(scenario.id);
    this.showAllZones.set(false);
    void this.refreshLayers().then(() => this.focusScenario(scenario));
  }

  showAll(): void {
    this.selectedScenarioId.set(null);
    this.showAllZones.set(true);
    void this.refreshLayers().then(() => this.focusGrid());
  }

  /** Ancre la grille de test sur le centre actuel de la carte (nouveau relief DEM). */
  relocateToMapCenter(): void {
    const map = this.map;
    if (!map) return;
    const c = map.getCenter();
    const toAnchor: [number, number] = [c.lng, c.lat];
    const fromAnchor = this.gridAnchor();
    if (
      Math.abs(toAnchor[0] - fromAnchor[0]) < 1e-7 &&
      Math.abs(toAnchor[1] - fromAnchor[1]) < 1e-7
    ) {
      void this.refreshLayers().then(() => this.focusGrid());
      return;
    }
    this.scenarios.set(
      relocateAirspaceDebugScenarios(this.scenarios(), fromAnchor, toAnchor)
    );
    this.gridAnchor.set(toAnchor);
    void this.refreshLayers().then(() => this.focusGrid());
  }

  focusScenario(scenario: AirspaceDebugScenario): void {
    const map = this.map;
    if (!map) return;
    const bounds = scenarioLngLatBounds(scenario) as LngLatBoundsLike;
    map.fitBounds(bounds, {
      padding: 72,
      maxZoom: scenario.camera.zoom,
      pitch: this.pitch(),
      bearing: this.bearing(),
      duration: 900
    });
  }

  focusGrid(): void {
    const map = this.map;
    if (!map) return;
    const scenarios = this.scenarios().filter(s => s.id !== 'large-area');
    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;
    for (const s of scenarios) {
      const [[w, so], [e, n]] = scenarioLngLatBounds(s);
      minLng = Math.min(minLng, w);
      minLat = Math.min(minLat, so);
      maxLng = Math.max(maxLng, e);
      maxLat = Math.max(maxLat, n);
    }
    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat]
      ],
      { padding: 48, duration: 900, pitch: this.pitch(), bearing: this.bearing() }
    );
  }

  applyCameraSliders(): void {
    const map = this.map;
    if (!map) return;
    map.easeTo({
      pitch: this.pitch(),
      bearing: this.bearing(),
      zoom: this.zoom(),
      duration: 400
    });
  }

  cameraPreset(preset: 'oblique' | 'side' | 'top' | 'low'): void {
    const map = this.map;
    const center = this.activeScenario()?.center ?? this.gridAnchor();
    let pitch = 62;
    let bearing = -28;
    let zoom = 13.2;
    switch (preset) {
      case 'oblique':
        pitch = 62;
        bearing = -28;
        zoom = 13.2;
        break;
      case 'side':
        pitch = 72;
        bearing = 105;
        zoom = 13.5;
        break;
      case 'top':
        pitch = 0;
        bearing = 0;
        zoom = 12.2;
        break;
      case 'low':
        pitch = MAP_FREE_CAMERA_MAX_PITCH;
        bearing = 40;
        zoom = 14.2;
        break;
    }
    this.pitch.set(pitch);
    this.bearing.set(bearing);
    this.zoom.set(zoom);
    if (map) {
      map.easeTo({ center, pitch, bearing, zoom, duration: 700 });
    }
  }

  private syncCameraFromMap(): void {
    const map = this.map;
    if (!map) return;
    this.pitch.set(Math.round(map.getPitch()));
    this.bearing.set(Math.round(map.getBearing()));
    this.zoom.set(Math.round(map.getZoom() * 10) / 10);
  }

  private firstOverlayLayerId(map: MaplibreMap): string {
    const layers = map.getStyle()?.layers ?? [];
    const first = layers.find(
      l => l.id !== MAP_LAYER.BASE_IMAGERY && l.id !== MAP_LAYER.TERRAIN_HILLSHADE
    );
    return first?.id ?? MAP_LAYER.TERRAIN_HILLSHADE;
  }

  private async refreshLayers(): Promise<void> {
    const map = this.map;
    if (!map || !this.mapReady()) return;

    this.applying.set(true);
    try {
      await this.waitForTerrainReady(map);

      const all = this.scenarios();
      const raw = this.showAllZones()
        ? buildAirspaceDebugFeatureCollection(all)
        : buildAirspaceDebugSubsetCollection(
            [this.selectedScenarioId() ?? all[0].id],
            all
          );

      const enriched = await enrichAirspaceDebugCollection(map, raw, {
        useDemGround: this.useDemGround()
      });
      const volumeCount = enriched.features.filter(f => f.properties?.hasVolume).length;
      const wireframeCount = buildAirspaceWireframeSpecs(enriched).length;
      this.volumeCount.set(volumeCount);
      this.wireframeCount.set(wireframeCount);

      removeAirspaceLayersFromMap(map);
      await applyAirspaceLayersToMap(map, DEBUG_AIRSPACE_RESULT, enriched, {
        beforeLayerId: this.firstOverlayLayerId(map),
        volume3d: this.volume3d(),
        onFeatureClick: e => {
          const feat = e.features?.[0];
          if (!feat || e.lngLat == null) return;
          new Popup({ closeOnClick: true, maxWidth: '320px' })
            .setLngLat(e.lngLat)
            .setHTML(
              this.airspaceLayer.buildPoaffPopupHtml(
                feat as Feature<Geometry, PoaffProperties>
              )
            )
            .addTo(map);
        }
      });

      this.statusLine.set(
        this.i18n.t('airspaceDebug.status', {
          volumes: volumeCount,
          wireframes: wireframeCount,
          total: enriched.features.length
        })
      );
    } finally {
      this.applying.set(false);
      map.triggerRepaint();
    }
  }

  private waitForTerrainReady(map: MaplibreMap): Promise<void> {
    if (map.getTerrain()) {
      return Promise.resolve();
    }
    return new Promise(resolve => {
      const onIdle = (): void => {
        if (map.getTerrain()) {
          map.off('idle', onIdle);
          resolve();
        }
      };
      map.on('idle', onIdle);
      setTimeout(() => {
        map.off('idle', onIdle);
        resolve();
      }, 4000);
    });
  }
}
