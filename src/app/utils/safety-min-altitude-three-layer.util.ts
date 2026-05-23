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
import type { SafetyMinAltitudeCrossingLabelSpec } from './safety-cone-crossings.util';
import {
  buildSafetyMinAltitudeStyledPath,
  type SafetyMinAltitudeStyledPoint
} from './safety-min-altitude-style.util';
import { SAFETY_PROFILE_SEMANTIC } from './safety-profile-palette.util';

export const SAFETY_MIN_ALTITUDE_LAYER_ID = 'safety-profile-min-altitude-3d';

const SAFETY_RIBBON_COLOR_CONE = hexToThreeColor(
  SAFETY_PROFILE_SEMANTIC.safetyMinAltitudeCone
);
const SAFETY_RIBBON_COLOR_TERRAIN = hexToThreeColor(
  SAFETY_PROFILE_SEMANTIC.safetyMinAltitudeTerrain
);

/** Demi-largeur du ruban (m) de chaque côté de l'axe de la branche. */
const SAFETY_RIBBON_HALF_WIDTH_M = 150;

export type SafetyMinAltitudePoint = SafetyMinAltitudeStyledPoint;

export function buildSafetyMinAltitudePath(
  samples: EnvelopeSample[]
): SafetyMinAltitudePoint[] {
  return buildSafetyMinAltitudeStyledPath(samples);
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
    vertexColors: true,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  private path: SafetyMinAltitudePoint[] = [];
  private crossingLabels: SafetyMinAltitudeCrossingLabelSpec[] = [];
  private lastProjectionMatrix: ArrayLike<number> | null = null;
  private visible = false;
  private positionsDirty = true;

  setPath(path: SafetyMinAltitudePoint[]): void {
    this.path = path;
    this.positionsDirty = true;
    this.rebuildRibbon();
    this.map?.triggerRepaint();
  }

  setCrossingLabels(labels: SafetyMinAltitudeCrossingLabelSpec[]): void {
    this.crossingLabels = labels;
    this.map?.triggerRepaint();
  }

  getLastProjectionMatrix(): ArrayLike<number> | null {
    return this.lastProjectionMatrix;
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
    this.positionsDirty = true;
    map.on('moveend', this.onMapChange);
    this.rebuildRibbon();
  }

  onRemove(): void {
    if (this.map) {
      try { this.map.off('moveend', this.onMapChange); } catch { /* */ }
    }
    cancelAnimationFrame(this.mapChangeRaf);
    this.disposeMesh();
    this.lastProjectionMatrix = null;
    this.renderer = null;
    this.map = null;
  }

  private mapChangeRaf = 0;
  private readonly onMapChange = (): void => {
    cancelAnimationFrame(this.mapChangeRaf);
    this.mapChangeRaf = requestAnimationFrame(() => {
      this.positionsDirty = true;
      this.map?.triggerRepaint();
    });
  };

  render(_gl: WebGLRenderingContext | WebGL2RenderingContext, args: CustomRenderMethodInput): void {
    if (!this.renderer) return;

    this.lastProjectionMatrix = args.defaultProjectionData.mainMatrix;

    const showRibbon = this.visible && this.mesh != null && this.path.length >= 2;
    if (!showRibbon) return;

    if (this.positionsDirty) {
      this.syncRibbonPositions();
      this.positionsDirty = false;
    }

    const projection = new THREE.Matrix4().fromArray(
      args.defaultProjectionData.mainMatrix
    );

    this.renderer.resetState();
    this.camera.projectionMatrix = projection;
    this.renderer.render(this.mesh!, this.camera);
  }

  private rebuildRibbon(): void {
    this.disposeMesh();
    if (this.path.length < 2) return;

    const { positions, colors, indices } = buildRibbonBuffers(this.path);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.scene.add(this.mesh);
  }

  private syncRibbonPositions(): void {
    if (!this.mesh || this.path.length < 2) return;
    const { positions, colors } = buildRibbonBuffers(this.path);
    const attr = this.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    attr.array.set(positions);
    attr.needsUpdate = true;
    const colorAttr = this.mesh.geometry.getAttribute('color') as THREE.BufferAttribute;
    colorAttr.array.set(colors);
    colorAttr.needsUpdate = true;
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
  colors: Float32Array;
  indices: Uint16Array | Uint32Array;
} {
  const n = path.length;
  const positions = new Float32Array(n * 2 * 3);
  const colors = new Float32Array(n * 2 * 3);
  const mercators = path.map(p => mercatorForPoint(p));
  const tangents = horizontalTangentsMercator(mercators);

  for (let i = 0; i < n; i++) {
    const mc = mercators[i];
    const scale = mc.meterInMercatorCoordinateUnits();
    const offset = perpendicularOffset(tangents[i], SAFETY_RIBBON_HALF_WIDTH_M * scale);
    const rgb = path[i].terrainConstrained
      ? SAFETY_RIBBON_COLOR_TERRAIN
      : SAFETY_RIBBON_COLOR_CONE;

    writeVertex(positions, i * 2, mc.x - offset.x, mc.y - offset.y, mc.z);
    writeVertex(positions, i * 2 + 1, mc.x + offset.x, mc.y + offset.y, mc.z);
    writeColor(colors, i * 2, rgb);
    writeColor(colors, i * 2 + 1, rgb);
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

  return { positions, colors, indices };
}

function hexToThreeColor(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function writeColor(
  buffer: Float32Array,
  vertexIndex: number,
  rgb: [number, number, number]
): void {
  const o = vertexIndex * 3;
  buffer[o] = rgb[0];
  buffer[o + 1] = rgb[1];
  buffer[o + 2] = rgb[2];
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
