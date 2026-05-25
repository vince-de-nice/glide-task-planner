/**
 * Calque MapLibre custom (Three.js) : parois verticales + arêtes verticales (sans toit ni fond).
 */
import * as THREE from 'three';
import {
  type CustomLayerInterface,
  type CustomRenderMethodInput,
  type Map as MaplibreMap
} from 'maplibre-gl';
import {
  AIRSPACE_VIEWPORT_CULLING_ENABLED,
  filterWireframeSpecsForViewport
} from './airspace-wireframe-perf.util';
import {
  AIRSPACE_WIREFRAME_LAYER_ID,
  buildAirspaceWallMeshBuffers,
  buildAirspaceWireframePositions,
  WIREFRAME_WALL_FILL_OPACITY,
  type AirspaceWireframeVolumeSpec
} from './airspace-wireframe.util';

export { AIRSPACE_WIREFRAME_LAYER_ID };

/** Arêtes du volume (verticales + contour plafond). */
const WIREFRAME_LINE_OPACITY = 1;

export function createAirspaceWireframeCustomLayer(): AirspaceWireframeThreeCustomLayer {
  return new AirspaceWireframeThreeCustomLayer();
}

interface ColorGroupRenderBundle {
  specs: AirspaceWireframeVolumeSpec[];
  walls: THREE.Mesh | null;
  lines: THREE.LineSegments;
}

export class AirspaceWireframeThreeCustomLayer implements CustomLayerInterface {
  readonly id = AIRSPACE_WIREFRAME_LAYER_ID;
  readonly type = 'custom' as const;
  readonly renderingMode = '3d' as const;

  private map: MaplibreMap | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly camera = new THREE.Camera();
  private readonly scene = new THREE.Scene();
  private readonly bundles: ColorGroupRenderBundle[] = [];
  private allSpecs: AirspaceWireframeVolumeSpec[] = [];
  private visible = false;
  private positionsDirty = true;
  private demResyncGeneration = 0;
  private demIdleHandler: (() => void) | null = null;

  setSpecs(specs: AirspaceWireframeVolumeSpec[]): void {
    this.allSpecs = specs;
    this.positionsDirty = true;
    this.rebuildBundles();
    this.scheduleDemResync();
    this.map?.triggerRepaint();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.map?.triggerRepaint();
  }

  onAdd(map: MaplibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    this.map = map;
    this.renderer = new THREE.WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
      antialias: false
    });
    this.renderer.autoClear = false;
    this.rebuildBundles();
    this.scheduleDemResync();
  }

  onRemove(): void {
    this.dispose();
  }

  /** Libération GPU / listeners sans passer par map.removeLayer (carte déjà détruite). */
  dispose(): void {
    if (!this.map && !this.renderer && this.bundles.length === 0) return;
    this.clearDemIdleHandler();
    this.visible = false;
    this.disposeBundles();
    this.renderer = null;
    this.map = null;
    this.allSpecs = [];
    this.positionsDirty = true;
  }

  render(_gl: WebGLRenderingContext | WebGL2RenderingContext, args: CustomRenderMethodInput): void {
    if (!this.map || !this.renderer || !this.visible || this.bundles.length === 0) return;

    if (this.positionsDirty) {
      this.syncGeometry();
      this.positionsDirty = false;
    }

    const projection = new THREE.Matrix4().fromArray(
      args.defaultProjectionData.mainMatrix
    );

    this.renderer.resetState();
    this.camera.projectionMatrix = projection;

    for (const bundle of this.bundles) {
      if (bundle.walls) {
        this.renderer.render(bundle.walls, this.camera);
      }
      this.renderer.render(bundle.lines, this.camera);
    }
  }

  private activeSpecs(): AirspaceWireframeVolumeSpec[] {
    const map = this.map;
    if (!map || this.allSpecs.length === 0) return [];
    if (!AIRSPACE_VIEWPORT_CULLING_ENABLED) {
      return this.allSpecs.filter(s => s.ring.length >= 3);
    }
    return filterWireframeSpecsForViewport(this.allSpecs, map);
  }

  /** Re-synchronise les altitudes terrain une fois les tuiles DEM disponibles (pas au zoom). */
  private scheduleDemResync(): void {
    const map = this.map;
    if (!map || !this.hasTerrainSpecs()) return;

    this.clearDemIdleHandler();
    const gen = ++this.demResyncGeneration;
    const onIdle = (): void => {
      this.clearDemIdleHandler();
      if (gen !== this.demResyncGeneration || !this.visible || this.bundles.length === 0) {
        return;
      }
      this.positionsDirty = true;
      map.triggerRepaint();
    };
    this.demIdleHandler = onIdle;
    map.once('idle', onIdle);
  }

  private clearDemIdleHandler(): void {
    const map = this.map;
    const handler = this.demIdleHandler;
    if (map && handler) {
      try {
        map.off('idle', handler);
      } catch {
        /* carte détruite */
      }
    }
    this.demIdleHandler = null;
  }

  private hasTerrainSpecs(): boolean {
    return this.allSpecs.some(
      s => s.needsTerrainSampling || s.useTerrainBase || s.useTerrainTop
    );
  }

  private rebuildBundles(): void {
    this.disposeBundles();
    const active = this.activeSpecs();
    if (active.length === 0) return;

    const byColor = new Map<string, AirspaceWireframeVolumeSpec[]>();
    for (const spec of active) {
      const key = spec.color.toLowerCase();
      const list = byColor.get(key) ?? [];
      list.push(spec);
      byColor.set(key, list);
    }

    const wallFillEnabled = WIREFRAME_WALL_FILL_OPACITY > 0.001;

    for (const [color, group] of byColor) {
      let walls: THREE.Mesh | null = null;
      if (wallFillEnabled) {
        const wallGeom = new THREE.BufferGeometry();
        wallGeom.setAttribute(
          'position',
          new THREE.BufferAttribute(new Float32Array(0), 3)
        );
        wallGeom.setIndex(new THREE.BufferAttribute(new Uint32Array(0), 1));

        const wallMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(color),
          transparent: true,
          opacity: WIREFRAME_WALL_FILL_OPACITY,
          depthTest: true,
          depthWrite: false,
          side: THREE.FrontSide
        });
        walls = new THREE.Mesh(wallGeom, wallMat);
        walls.frustumCulled = false;
        this.scene.add(walls);
      }

      const lineGeom = new THREE.BufferGeometry();
      lineGeom.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(0), 3)
      );

      const lineMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: WIREFRAME_LINE_OPACITY,
        depthTest: true,
        depthWrite: false,
        linewidth: 2
      });

      const lines = new THREE.LineSegments(lineGeom, lineMat);
      lines.frustumCulled = false;

      this.scene.add(lines);
      this.bundles.push({ specs: group, walls, lines });
    }

    this.positionsDirty = true;
  }

  private syncGeometry(): void {
    const map = this.map;
    if (!map) return;

    for (const bundle of this.bundles) {
      if (bundle.walls) {
        const walls = buildAirspaceWallMeshBuffers(bundle.specs, map);
        if (walls.indices.length > 0) {
          bundle.walls.geometry.setAttribute(
            'position',
            new THREE.BufferAttribute(walls.positions, 3)
          );
          bundle.walls.geometry.setIndex(
            new THREE.BufferAttribute(walls.indices, 1)
          );
        } else {
          bundle.walls.geometry.setAttribute(
            'position',
            new THREE.BufferAttribute(new Float32Array(0), 3)
          );
          bundle.walls.geometry.setIndex(
            new THREE.BufferAttribute(new Uint32Array(0), 1)
          );
        }
      }

      const linePos = buildAirspaceWireframePositions(bundle.specs, map);
      if (linePos.length >= 6) {
        bundle.lines.geometry.setAttribute(
          'position',
          new THREE.BufferAttribute(linePos, 3)
        );
      }
    }
  }

  private disposeBundles(): void {
    const disposedMaterials = new Set<THREE.Material>();
    for (const bundle of this.bundles) {
      const objs = bundle.walls ? [bundle.walls, bundle.lines] : [bundle.lines];
      for (const obj of objs) {
        obj.geometry.dispose();
        const mat = obj.material;
        const materials = Array.isArray(mat) ? mat : [mat];
        for (const m of materials) {
          if (!disposedMaterials.has(m)) {
            m.dispose();
            disposedMaterials.add(m);
          }
        }
        this.scene.remove(obj);
      }
    }
    this.bundles.length = 0;
  }
}
