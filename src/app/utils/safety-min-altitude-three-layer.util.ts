/**
 * Calque MapLibre custom (Three.js) : ruban 3D de l'altitude minimale combinée (safetyM).
 */
import * as THREE from 'three';
import {
  MercatorCoordinate,
  type CustomLayerInterface,
  type CustomRenderMethodInput,
  type Map as MaplibreMap
} from 'maplibre-gl';
import type { EnvelopeSample } from '../services/glide-envelope.service';

export const SAFETY_MIN_ALTITUDE_LAYER_ID = 'safety-profile-min-altitude-3d';

/** Rouge aligné sur la coupe profil (.leg-chart__safety-line). */
const SAFETY_RIBBON_COLOR = 0xdc2626;

/** Demi-largeur du ruban (m) de chaque côté de l'axe de la branche. */
const SAFETY_RIBBON_HALF_WIDTH_M = 150;

export interface SafetyMinAltitudePoint {
  longitude: number;
  latitude: number;
  altitudeM: number;
}

export function buildSafetyMinAltitudePath(
  samples: EnvelopeSample[]
): SafetyMinAltitudePoint[] {
  const path: SafetyMinAltitudePoint[] = [];
  for (const s of samples) {
    if (s.safetyM == null || !Number.isFinite(s.safetyM)) continue;
    path.push({
      longitude: s.longitude,
      latitude: s.latitude,
      altitudeM: s.safetyM
    });
  }
  return path;
}

export function createSafetyMinAltitudeCustomLayer(): SafetyMinAltitudeThreeCustomLayer {
  return new SafetyMinAltitudeThreeCustomLayer();
}

export class SafetyMinAltitudeThreeCustomLayer implements CustomLayerInterface {
  readonly id = SAFETY_MIN_ALTITUDE_LAYER_ID;
  readonly type = 'custom' as const;
  readonly renderingMode = '3d' as const;

  private map: MaplibreMap | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly camera = new THREE.Camera();
  private readonly scene = new THREE.Scene();
  private mesh: THREE.Mesh | null = null;
  /** Basic : la couleur ne dépend pas des lumières (incompatibles avec la caméra custom MapLibre). */
  private readonly material = new THREE.MeshBasicMaterial({
    color: SAFETY_RIBBON_COLOR,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  private path: SafetyMinAltitudePoint[] = [];
  private visible = false;

  setPath(path: SafetyMinAltitudePoint[]): void {
    this.path = path;
    this.rebuildRibbon();
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
    this.rebuildRibbon();
  }

  onRemove(): void {
    this.disposeMesh();
    // Ne pas appeler renderer.dispose() : contexte WebGL partagé avec MapLibre.
    this.renderer = null;
    this.map = null;
  }

  render(_gl: WebGLRenderingContext | WebGL2RenderingContext, args: CustomRenderMethodInput): void {
    if (!this.renderer || !this.visible || !this.mesh || this.path.length < 2) return;

    this.syncRibbonPositions();

    const projection = new THREE.Matrix4().fromArray(
      args.defaultProjectionData.mainMatrix
    );
    this.renderer.resetState();
    this.camera.projectionMatrix = projection;
    this.renderer.render(this.mesh, this.camera);
  }

  private rebuildRibbon(): void {
    this.disposeMesh();
    if (this.path.length < 2) return;

    const { positions, indices } = buildRibbonBuffers(this.path);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.scene.add(this.mesh);
  }

  private syncRibbonPositions(): void {
    if (!this.mesh || this.path.length < 2) return;
    const { positions } = buildRibbonBuffers(this.path);
    const attr = this.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    attr.array.set(positions);
    attr.needsUpdate = true;
    this.mesh.geometry.computeVertexNormals();
  }

  private disposeMesh(): void {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.scene.remove(this.mesh);
      this.mesh = null;
    }
  }
}

function buildRibbonBuffers(path: SafetyMinAltitudePoint[]): {
  positions: Float32Array;
  indices: Uint16Array | Uint32Array;
} {
  const n = path.length;
  const positions = new Float32Array(n * 2 * 3);
  const mercators = path.map(p => mercatorForPoint(p));
  const tangents = horizontalTangentsMercator(mercators);

  for (let i = 0; i < n; i++) {
    const mc = mercators[i];
    const scale = mc.meterInMercatorCoordinateUnits();
    const offset = perpendicularOffset(tangents[i], SAFETY_RIBBON_HALF_WIDTH_M * scale);

    writeVertex(positions, i * 2, mc.x - offset.x, mc.y - offset.y, mc.z);
    writeVertex(positions, i * 2 + 1, mc.x + offset.x, mc.y + offset.y, mc.z);
  }

  const segCount = n - 1;
  const use32 = n * 2 > 65535;
  const indices = use32
    ? new Uint32Array(segCount * 6)
    : new Uint16Array(segCount * 6);

  let idx = 0;
  for (let i = 0; i < segCount; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices[idx++] = a;
    indices[idx++] = c;
    indices[idx++] = b;
    indices[idx++] = b;
    indices[idx++] = c;
    indices[idx++] = d;
  }

  return { positions, indices };
}

function mercatorForPoint(point: SafetyMinAltitudePoint): MercatorCoordinate {
  return MercatorCoordinate.fromLngLat(
    [point.longitude, point.latitude],
    point.altitudeM
  );
}

/** Tangente horizontale (plan XY mercator) par point. */
function horizontalTangentsMercator(
  mercators: MercatorCoordinate[]
): THREE.Vector2[] {
  const n = mercators.length;
  const tangents: THREE.Vector2[] = [];
  for (let i = 0; i < n; i++) {
    const prev = mercators[Math.max(0, i - 1)];
    const next = mercators[Math.min(n - 1, i + 1)];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-12) {
      tangents.push(new THREE.Vector2(1, 0));
    } else {
      tangents.push(new THREE.Vector2(dx / len, dy / len));
    }
  }
  return tangents;
}

function perpendicularOffset(
  tangent: THREE.Vector2,
  halfWidthMercator: number
): THREE.Vector2 {
  return new THREE.Vector2(-tangent.y, tangent.x).multiplyScalar(halfWidthMercator);
}

function writeVertex(
  buffer: Float32Array,
  vertexIndex: number,
  x: number,
  y: number,
  z: number
): void {
  const o = vertexIndex * 3;
  buffer[o] = x;
  buffer[o + 1] = y;
  buffer[o + 2] = z;
}
