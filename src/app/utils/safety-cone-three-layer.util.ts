/**
 * Calque MapLibre custom (Three.js) : cônes de demi-finesse lisses en altitude MSL.
 *
 * Sommet = terrain posable (baseAltitudeM), base = altitude max de la courbe du cône.
 * Rayon à la base (m) = (topAlt - tipAlt) * halfRatio / 1000 * 1000.
 */
import * as THREE from 'three';
import {
  MercatorCoordinate,
  type CustomLayerInterface,
  type CustomRenderMethodInput,
  type Map as MaplibreMap
} from 'maplibre-gl';
import type { LandableConeVisual } from '../services/glide-envelope.service';
import { landableConeColorFromId } from './safety-profile-chart.util';

export const SAFETY_CONES_CUSTOM_LAYER_ID = 'safety-profile-cones-3d';

/** Cercles de distance sur la surface du cône : diamètres 10, 20, 30… km. */
export const CONE_SURFACE_RING_DIAMETER_STEP_KM = 10;

const RING_SEGMENTS = 64;

/** API MapLibre ≥ 5.24 (pas encore dans tous les types publiés). */
type CustomRenderArgs = CustomRenderMethodInput & {
  getMatrixForModel?: (
    lngLat: [number, number],
    altitude: number
  ) => Float32Array | number[];
};

export interface SafetyConeMeshSpec {
  id: string;
  longitude: number;
  latitude: number;
  tipAltitudeM: number;
  topAltitudeM: number;
  halfRatio: number;
  color: string;
  opacity: number;
}

export interface SafetyConeMeshInput {
  landableCones: LandableConeVisual[];
  halfRatio: number;
  landableApexLngLat: ReadonlyMap<string, [number, number]>;
}

/** Métriques géométriques d'un cône (indépendant du relief). */
export function coneTopAltitudeM(cone: LandableConeVisual): number {
  return cone.curve.reduce(
    (mx, c) => Math.max(mx, c.altitudeM),
    cone.baseAltitudeM + 200
  );
}

export function buildSafetyConeMeshSpecs(
  input: SafetyConeMeshInput
): SafetyConeMeshSpec[] {
  const specs: SafetyConeMeshSpec[] = [];

  for (const cone of input.landableCones) {
    const apex = input.landableApexLngLat.get(cone.id);
    if (!apex) continue;

    const tipAltitudeM = cone.baseAltitudeM;
    const topAltitudeM = coneTopAltitudeM(cone);
    const heightM = topAltitudeM - tipAltitudeM;
    if (heightM < 50) continue;

    const radiusM = (heightM * input.halfRatio) / 1000 * 1000;
    if (radiusM < 50) continue;

    specs.push({
      id: cone.id,
      longitude: apex[0],
      latitude: apex[1],
      tipAltitudeM,
      topAltitudeM,
      halfRatio: input.halfRatio,
      color: landableConeColorFromId(cone.id),
      opacity: cone.isBinding ? 0.42 : 0.32
    });
  }

  return specs;
}

export function createSafetyConeCustomLayer(): SafetyConeThreeCustomLayer {
  return new SafetyConeThreeCustomLayer();
}

export class SafetyConeThreeCustomLayer implements CustomLayerInterface {
  readonly id = SAFETY_CONES_CUSTOM_LAYER_ID;
  readonly type = 'custom' as const;
  readonly renderingMode = '3d' as const;

  private map: MaplibreMap | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly camera = new THREE.Camera();
  private readonly scene = new THREE.Scene();
  private readonly meshes: THREE.Object3D[] = [];
  private specs: SafetyConeMeshSpec[] = [];
  private visible = false;

  setSpecs(specs: SafetyConeMeshSpec[]): void {
    this.specs = specs;
    this.rebuildMeshes();
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

    const lightA = new THREE.DirectionalLight(0xffffff, 0.85);
    lightA.position.set(50, 80, 120).normalize();
    this.scene.add(lightA);

    const lightB = new THREE.DirectionalLight(0xffffff, 0.45);
    lightB.position.set(-60, -40, 80).normalize();
    this.scene.add(lightB);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    this.rebuildMeshes();
  }

  onRemove(): void {
    this.disposeMeshes();
    this.renderer?.dispose();
    this.renderer = null;
    this.map = null;
  }

  render(_gl: WebGLRenderingContext | WebGL2RenderingContext, args: CustomRenderMethodInput): void {
    if (!this.renderer || !this.visible || this.meshes.length === 0) return;

    const projection = new THREE.Matrix4().fromArray(
      args.defaultProjectionData.mainMatrix
    );

    this.renderer.resetState();

    for (const obj of this.meshes) {
      const spec = obj.userData['spec'] as SafetyConeMeshSpec;
      const model = this.modelMatrixForCone(spec, args);
      this.camera.projectionMatrix = projection.clone().multiply(model);
      this.renderer.render(obj, this.camera);
    }
  }

  private rebuildMeshes(): void {
    this.disposeMeshes();

    for (const spec of this.specs) {
      const heightM = spec.topAltitudeM - spec.tipAltitudeM;
      const radiusM = (heightM * spec.halfRatio) / 1000 * 1000;
      if (heightM < 1 || radiusM < 1) continue;

      /*
       * ConeGeometry (Three.js) : apex en y=+h/2, base en y=−h/2 (centré sur l'origine).
       * On veut : sommet (tip) à l'origine du mesh, base large vers +Y (altitude croissante).
       */
      const geometry = new THREE.ConeGeometry(radiusM, heightM, 48, 1, false);
      geometry.translate(0, -heightM / 2, 0);
      geometry.rotateX(Math.PI);

      const material = new THREE.MeshLambertMaterial({
        color: new THREE.Color(spec.color),
        transparent: true,
        opacity: spec.opacity,
        depthWrite: false,
        side: THREE.DoubleSide
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData['spec'] = spec;
      this.meshes.push(mesh);
      this.scene.add(mesh);

      const ringMaterial = new THREE.LineBasicMaterial({
        color: new THREE.Color(spec.color),
        transparent: true,
        opacity: Math.min(0.92, spec.opacity + 0.45),
        depthWrite: false
      });

      const maxRadiusKm = radiusM / 1000;
      for (const diameterKm of coneSurfaceRingDiametersKm(maxRadiusKm)) {
        const ringGeom = buildConeSurfaceRingGeometry(
          diameterKm,
          spec.halfRatio,
          heightM
        );
        if (!ringGeom) continue;

        const ring = new THREE.LineLoop(ringGeom, ringMaterial);
        ring.userData['spec'] = spec;
        this.meshes.push(ring);
        this.scene.add(ring);
      }
    }
  }

  private disposeMeshes(): void {
    const disposedMaterials = new Set<THREE.Material>();
    for (const obj of this.meshes) {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
        obj.geometry.dispose();
      }
      const mat =
        obj instanceof THREE.Mesh || obj instanceof THREE.Line
          ? obj.material
          : null;
      if (!mat) continue;
      const materials = Array.isArray(mat) ? mat : [mat];
      for (const m of materials) {
        if (!disposedMaterials.has(m)) {
          m.dispose();
          disposedMaterials.add(m);
        }
      }
      this.scene.remove(obj);
    }
    this.meshes.length = 0;
  }

  /** Ancre le sommet du cône (y=0 local) au waypoint, altitude tipAltitudeM MSL. */
  private modelMatrixForCone(
    spec: SafetyConeMeshSpec,
    args: CustomRenderMethodInput
  ): THREE.Matrix4 {
    const origin: [number, number] = [spec.longitude, spec.latitude];
    const ext = args as CustomRenderArgs;

    if (typeof ext.getMatrixForModel === 'function') {
      return new THREE.Matrix4().fromArray(
        ext.getMatrixForModel(origin, spec.tipAltitudeM)
      );
    }

    const mc = MercatorCoordinate.fromLngLat(origin, spec.tipAltitudeM);
    const scale = mc.meterInMercatorCoordinateUnits();
    const rotX = new THREE.Matrix4().makeRotationAxis(
      new THREE.Vector3(1, 0, 0),
      Math.PI / 2
    );

    return new THREE.Matrix4()
      .makeTranslation(mc.x, mc.y, mc.z)
      .scale(new THREE.Vector3(scale, -scale, scale))
      .multiply(rotX);
  }
}

/** Diamètres 10, 20, 30… km tant que le cercle tient sur le cône (rayon ≤ base). */
export function coneSurfaceRingDiametersKm(maxRadiusKm: number): number[] {
  if (maxRadiusKm < CONE_SURFACE_RING_DIAMETER_STEP_KM / 2) return [];
  const maxDiameterKm = maxRadiusKm * 2;
  const diameters: number[] = [];
  for (
    let d = CONE_SURFACE_RING_DIAMETER_STEP_KM;
    d <= maxDiameterKm + 1e-6;
    d += CONE_SURFACE_RING_DIAMETER_STEP_KM
  ) {
    diameters.push(d);
  }
  return diameters;
}

/**
 * Cercle à distance horizontale d = diamètre/2 du sommet, sur la surface du cône.
 * Altitude locale (axe Y) : d(km) × 1000 / halfRatio ; rayon du cercle : d(km).
 */
function buildConeSurfaceRingGeometry(
  diameterKm: number,
  halfRatio: number,
  coneHeightM: number
): THREE.BufferGeometry | null {
  const radiusKm = diameterKm / 2;
  const ySliceM = (radiusKm * 1000) / halfRatio;
  if (ySliceM <= 0 || ySliceM >= coneHeightM) return null;

  const circleRadiusM = radiusKm * 1000;
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= RING_SEGMENTS; i++) {
    const t = (i / RING_SEGMENTS) * Math.PI * 2;
    points.push(
      new THREE.Vector3(
        circleRadiusM * Math.cos(t),
        ySliceM,
        circleRadiusM * Math.sin(t)
      )
    );
  }
  return new THREE.BufferGeometry().setFromPoints(points);
}
