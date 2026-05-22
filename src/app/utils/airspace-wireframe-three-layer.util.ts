/**
 * Calque MapLibre custom (Three.js) : fil de fer 3D des volumes d'espaces aériens.
 */
import * as THREE from 'three';
import {
  type CustomLayerInterface,
  type CustomRenderMethodInput,
  type Map as MaplibreMap
} from 'maplibre-gl';
import {
  AIRSPACE_WIREFRAME_LAYER_ID,
  buildAirspaceWireframePositions,
  type AirspaceWireframeVolumeSpec
} from './airspace-wireframe.util';

export { AIRSPACE_WIREFRAME_LAYER_ID };

export function createAirspaceWireframeCustomLayer(): AirspaceWireframeThreeCustomLayer {
  return new AirspaceWireframeThreeCustomLayer();
}

export class AirspaceWireframeThreeCustomLayer implements CustomLayerInterface {
  readonly id = AIRSPACE_WIREFRAME_LAYER_ID;
  readonly type = 'custom' as const;
  readonly renderingMode = '3d' as const;

  private map: MaplibreMap | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly camera = new THREE.Camera();
  private readonly scene = new THREE.Scene();
  private readonly lineGroups: THREE.LineSegments[] = [];
  /** Groupes alignés sur {@link lineGroups} (même ordre). */
  private colorGroups: AirspaceWireframeVolumeSpec[][] = [];
  private specs: AirspaceWireframeVolumeSpec[] = [];
  private visible = false;

  setSpecs(specs: AirspaceWireframeVolumeSpec[]): void {
    this.specs = specs;
    this.rebuildLineGroups();
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
      antialias: true
    });
    this.renderer.autoClear = false;
    this.rebuildLineGroups();
  }

  onRemove(): void {
    this.disposeLineGroups();
    this.renderer = null;
    this.map = null;
  }

  render(_gl: WebGLRenderingContext | WebGL2RenderingContext, args: CustomRenderMethodInput): void {
    if (!this.renderer || !this.visible || this.lineGroups.length === 0) return;

    this.syncLinePositions();

    const projection = new THREE.Matrix4().fromArray(
      args.defaultProjectionData.mainMatrix
    );

    this.renderer.resetState();
    this.camera.projectionMatrix = projection;

    for (const lines of this.lineGroups) {
      this.renderer.render(lines, this.camera);
    }
  }

  private rebuildLineGroups(): void {
    this.disposeLineGroups();
    this.colorGroups = [];
    if (this.specs.length === 0) return;

    const byColor = new Map<string, AirspaceWireframeVolumeSpec[]>();
    for (const spec of this.specs) {
      const key = spec.color.toLowerCase();
      const list = byColor.get(key) ?? [];
      list.push(spec);
      byColor.set(key, list);
    }

    for (const [color, group] of byColor) {
      const positions = buildAirspaceWireframePositions(group, this.map);
      if (positions.length < 6) continue;

      this.colorGroups.push(group);

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const material = new THREE.LineBasicMaterial({
        color: new THREE.Color(color),
        transparent: true,
        opacity: 0.92,
        depthTest: true,
        depthWrite: false
      });

      const lines = new THREE.LineSegments(geometry, material);
      lines.frustumCulled = false;
      this.lineGroups.push(lines);
      this.scene.add(lines);
    }
  }

  private syncLinePositions(): void {
    for (let i = 0; i < this.lineGroups.length; i++) {
      const lines = this.lineGroups[i];
      const group = this.colorGroups[i];
      if (!group) continue;

      const positions = buildAirspaceWireframePositions(group, this.map);
      const attr = lines.geometry.getAttribute('position') as THREE.BufferAttribute;
      if (attr.array.length !== positions.length) {
        lines.geometry.setAttribute(
          'position',
          new THREE.BufferAttribute(positions, 3)
        );
      } else {
        attr.array.set(positions);
        attr.needsUpdate = true;
      }
    }
  }

  private disposeLineGroups(): void {
    const disposedMaterials = new Set<THREE.Material>();
    for (const lines of this.lineGroups) {
      lines.geometry.dispose();
      const mat = lines.material;
      const materials = Array.isArray(mat) ? mat : [mat];
      for (const m of materials) {
        if (!disposedMaterials.has(m)) {
          m.dispose();
          disposedMaterials.add(m);
        }
      }
      this.scene.remove(lines);
    }
    this.lineGroups.length = 0;
    this.colorGroups = [];
  }
}
