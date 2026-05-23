/**
 * Calque MapLibre custom (Three.js) : parois verticales + arêtes verticales (sans toit ni fond).
 */
import * as THREE from 'three';
import {
  type CustomLayerInterface,
  type CustomRenderMethodInput,
  type Map as MaplibreMap
} from 'maplibre-gl';
import { filterWireframeSpecsForViewport } from './airspace-wireframe-perf.util';
import {
  AIRSPACE_WIREFRAME_LAYER_ID,
  buildAirspaceWallMeshBuffers,
  buildAirspaceWireframePositions,
  type AirspaceWireframeVolumeSpec
} from './airspace-wireframe.util';

export { AIRSPACE_WIREFRAME_LAYER_ID };

/** Opacité des parois verticales (pas de toit ni de fond). */
const WALL_FILL_OPACITY = 0.22;

export function createAirspaceWireframeCustomLayer(): AirspaceWireframeThreeCustomLayer {
  return new AirspaceWireframeThreeCustomLayer();
}

interface ColorGroupRenderBundle {
  specs: AirspaceWireframeVolumeSpec[];
  walls: THREE.Mesh;
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

  private mapChangeRaf = 0;
  private lastViewportKey = '';

  private readonly onMapChange = (): void => {
    cancelAnimationFrame(this.mapChangeRaf);
    this.mapChangeRaf = requestAnimationFrame(() => {
      const key = this.viewportKey();
      if (key === this.lastViewportKey) return;
      this.lastViewportKey = key;
      this.positionsDirty = true;
      this.rebuildBundles();
      this.map?.triggerRepaint();
    });
  };

  private viewportKey(): string {
    const map = this.map;
    if (!map) return '';
    const c = map.getCenter();
    const z = map.getZoom();
    const p = map.getPitch();
    const b = map.getBearing();
    return `${c.lng.toFixed(5)},${c.lat.toFixed(5)},${z.toFixed(2)},${p.toFixed(1)},${b.toFixed(1)}`;
  }

  setSpecs(specs: AirspaceWireframeVolumeSpec[]): void {
    this.allSpecs = specs;
    this.positionsDirty = true;
    this.rebuildBundles();
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
    map.on('moveend', this.onMapChange);
    this.lastViewportKey = '';
    this.rebuildBundles();
  }

  onRemove(): void {
    this.dispose();
  }

  /** Libération GPU / listeners sans passer par map.removeLayer (carte déjà détruite). */
  dispose(): void {
    if (!this.map && !this.renderer && this.bundles.length === 0) return;
    cancelAnimationFrame(this.mapChangeRaf);
    const map = this.map;
    if (map) {
      try {
        map.off('moveend', this.onMapChange);
      } catch {
        /* ignore */
      }
    }
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
      this.renderer.render(bundle.walls, this.camera);
      this.renderer.render(bundle.lines, this.camera);
    }
  }

  private activeSpecs(): AirspaceWireframeVolumeSpec[] {
    const map = this.map;
    if (!map || this.allSpecs.length === 0) return [];
    return filterWireframeSpecsForViewport(this.allSpecs, map);
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

    for (const [color, group] of byColor) {
      const wallGeom = new THREE.BufferGeometry();
      wallGeom.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(0), 3)
      );
      wallGeom.setIndex(new THREE.BufferAttribute(new Uint32Array(0), 1));

      const wallMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: WALL_FILL_OPACITY,
        depthTest: true,
        depthWrite: false,
        side: THREE.DoubleSide
      });

      const lineGeom = new THREE.BufferGeometry();
      lineGeom.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(0), 3)
      );

      const lineMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 0.95,
        depthTest: true,
        depthWrite: false
      });

      const walls = new THREE.Mesh(wallGeom, wallMat);
      const lines = new THREE.LineSegments(lineGeom, lineMat);
      walls.frustumCulled = false;
      lines.frustumCulled = false;

      this.scene.add(walls);
      this.scene.add(lines);
      this.bundles.push({ specs: group, walls, lines });
    }

    this.positionsDirty = true;
  }

  private syncGeometry(): void {
    const map = this.map;
    if (!map) return;

    for (const bundle of this.bundles) {
      const walls = buildAirspaceWallMeshBuffers(bundle.specs, map);
      if (walls.indices.length > 0) {
        bundle.walls.geometry.setAttribute(
          'position',
          new THREE.BufferAttribute(walls.positions, 3)
        );
        bundle.walls.geometry.setIndex(
          new THREE.BufferAttribute(walls.indices, 1)
        );
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
      for (const obj of [bundle.walls, bundle.lines]) {
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
