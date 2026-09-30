import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { PALETTE, label } from './model-kit';

const WHEEL_NODE = 'WHeelsandrims_2';
const WHEEL_PIVOT = 'vehicle-wheel-pivot';
/** Upstream names the tyre material a rim; the rubber is what we use as the axle reference. */
const TYRE_MATERIAL = 'm8rim001';

function corner(point: THREE.Vector3) {
  return `${point.x >= 0 ? 'r' : 'l'}${point.z >= 0 ? 'f' : 'b'}`;
}

/**
 * The published asset merges all four wheels into three meshes, so the axles are baked in
 * and the corners cannot turn. Split every merged mesh per corner around the tyre, which is
 * rotationally symmetric, and hang each corner on its own pivot at the axle.
 *
 * Corners are read in world space, because the merged geometry sits entirely inside one
 * octant of the wheel node's own space and its signs tell nothing apart. The tyre's axle is
 * the node's X axis, which is also the car's, so a pivot spins by its own rotation.x.
 */
function splitVehicleWheels(wheels: THREE.Object3D) {
  const parts = wheels.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh);
  const tyre = parts.find((part) => {
    const material = Array.isArray(part.material) ? part.material[0] : part.material;
    return material?.name.toLowerCase().includes(TYRE_MATERIAL);
  });
  if (!tyre) return;
  const toNode = wheels.matrixWorld.clone().invert();
  const boxes = new Map<string, THREE.Box3>();
  const point = new THREE.Vector3();
  const tyrePosition = tyre.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < tyrePosition.count; i++) {
    point.fromBufferAttribute(tyrePosition, i).applyMatrix4(tyre.matrixWorld);
    const box = boxes.get(corner(point)) ?? new THREE.Box3();
    box.expandByPoint(point);
    boxes.set(corner(point), box);
  }
  if (boxes.size < 4) return;
  const centres = new Map(
    [...boxes].map(([key, box]) => [
      key,
      box.getCenter(new THREE.Vector3()).applyMatrix4(toNode),
    ]),
  );
  const pivots = new Map(
    [...centres].map(([key, centre]) => {
      const pivot = new THREE.Object3D();
      pivot.name = WHEEL_PIVOT;
      pivot.position.copy(centre);
      wheels.add(pivot);
      return [key, pivot];
    }),
  );

  const normalMatrix = new THREE.Matrix3();
  for (const part of parts) {
    const index = part.geometry.index;
    const position = part.geometry.attributes.position as THREE.BufferAttribute;
    const normal = part.geometry.attributes.normal as THREE.BufferAttribute | undefined;
    const count = index ? index.count : position.count;
    normalMatrix.getNormalMatrix(part.matrix);
    const triangles = new Map<string, number[]>();
    const centroid = new THREE.Vector3();
    for (let i = 0; i < count; i += 3) {
      centroid.set(0, 0, 0);
      for (let k = 0; k < 3; k++) {
        const vertex = index ? index.getX(i + k) : i + k;
        centroid.add(point.fromBufferAttribute(position, vertex).applyMatrix4(part.matrixWorld));
      }
      const list = triangles.get(corner(centroid)) ?? [];
      for (let k = 0; k < 3; k++) list.push(index ? index.getX(i + k) : i + k);
      triangles.set(corner(centroid), list);
    }
    for (const [key, list] of triangles) {
      const pivot = pivots.get(key);
      if (!pivot) continue;
      const remap = new Map<number, number>();
      const centre = centres.get(key)!;
      const outPosition: number[] = [];
      const outNormal: number[] = [];
      const outIndex: number[] = [];
      for (const vertex of list) {
        remap.set(vertex, outPosition.length / 3);
        outPosition.push(
          ...point.fromBufferAttribute(position, vertex).applyMatrix4(part.matrix).sub(centre).toArray(),
        );
        if (normal) {
          outNormal.push(
            ...point.fromBufferAttribute(normal, vertex).applyMatrix3(normalMatrix).normalize().toArray(),
          );
        }
      }
      for (const vertex of list) outIndex.push(remap.get(vertex)!);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(outPosition, 3));
      if (outNormal.length)
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(outNormal, 3));
      geometry.setIndex(outIndex);
      const mesh = new THREE.Mesh(geometry, part.material);
      mesh.name = `${part.name}-${key}`;
      pivot.add(mesh);
    }
    part.removeFromParent();
    part.geometry.dispose();
  }
}

/** Local CC BY asset; attribution and derivation are in public/models/carwash. */
export async function loadVehicleAsset(signal: AbortSignal) {
  const response = await fetch('/models/carwash/vehicle.glb', { signal });
  if (!response.ok) throw new Error('Vehicle asset unavailable');
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.parseAsync(await response.arrayBuffer(), '');
  const source = gltf.scene;
  // Authoring transforms are retained; normalize the complete hierarchy in metres.
  source.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(source);
  const size = bounds.getSize(new THREE.Vector3());
  const centre = bounds.getCenter(new THREE.Vector3());
  const scale = 4.85 / size.z;
  source.scale.multiplyScalar(scale);
  source.position.set(-centre.x * scale, -bounds.min.y * scale + 0.035, -centre.z * scale);
  const wheels = source.getObjectByName(WHEEL_NODE);
  if (wheels) {
    source.updateMatrixWorld(true);
    splitVehicleWheels(wheels);
  }
  const template = new THREE.Group();
  template.add(source);
  if (signal.aborted) {
    disposeVehicleAsset(template);
    throw new DOMException('Aborted', 'AbortError');
  }
  return template;
}

/** Axle pivots of a vehicle instance, cloned from the template, one per corner. */
export function vehicleWheels(root: THREE.Object3D) {
  const wheels: THREE.Object3D[] = [];
  root.traverse((object) => {
    if (object.name === WHEEL_PIVOT) wheels.push(object);
  });
  return wheels;
}

const FRONT_PLATE_Y = 0.53;
const REAR_PLATE_Y = 0.87;
const REAR_PLATE_Z = -2.393;
const PLATE_WIDTH = 0.53;
const PLATE_HEIGHT = 0.115;

export function vehicleInstance(template: THREE.Group, white = false) {
  const instance = template.clone(true);
  const materials = new Map<THREE.Material, THREE.Material>();
  instance.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = object.receiveShadow = true;
    const style = (original: THREE.MeshStandardMaterial) => {
      const existing = materials.get(original);
      if (existing) return existing;
      const mat = original.clone();
      const name = mat.name.toLowerCase();
      if (
        name.includes('body15') ||
        name.includes('livery') ||
        name.includes('white4') ||
        name.includes('zx1')
      ) {
        mat.map = null;
        mat.color.set(white ? PALETTE.white : PALETTE.paint);
        mat.metalness = 0.72;
        mat.roughness = 0.24;
      } else if (name.includes('windows') || name.includes('headlight5')) {
        mat.color.set(PALETTE.glass);
        mat.opacity = 1;
        mat.transparent = false;
        mat.metalness = 0.25;
        mat.roughness = 0.16;
      } else if (name.includes('m8rim001')) {
        // Upstream names this tyre material as a rim; its texture was removed in the web asset.
        mat.color.set(PALETTE.rubber);
        mat.metalness = 0.04;
        mat.roughness = 0.88;
        mat.envMapIntensity = 0.35;
      } else if (name.includes('rim') || name.includes('chrome')) {
        mat.color.set(PALETTE.steel);
        mat.metalness = 0.9;
        mat.roughness = 0.28;
      } else {
        mat.roughness = Math.max(0.35, mat.roughness);
      }
      materials.set(original, mat);
      return mat;
    };
    object.material = Array.isArray(object.material)
      ? object.material.map((mat) => style(mat))
      : style(object.material);
  });
  for (const z of [-2.43, 2.43]) {
    const rear = z < 0;
    const plate = label(
      white ? '728 AKM 02' : '559 BJV 05',
      PLATE_WIDTH,
      PLATE_HEIGHT,
      PALETTE.white,
      PALETTE.black,
    );
    plate.name = 'session-license-plate';
    if (rear) {
      plate.position.set(0, REAR_PLATE_Y, REAR_PLATE_Z);
      plate.rotation.y = Math.PI;
    } else {
      plate.position.set(0, FRONT_PLATE_Y, z);
    }
    instance.add(plate);
  }
  return instance;
}

export function updateVehiclePlate(instance: THREE.Object3D, text: string) {
  instance.traverse((object) => {
    if (
      !(object instanceof THREE.Mesh) ||
      object.name !== 'session-license-plate' ||
      object.userData.plate === text
    )
      return;
    object.userData.plate = text;
    const mat = object.material as THREE.MeshBasicMaterial;
    const canvas = mat.map?.image as HTMLCanvasElement | undefined;
    const context = canvas?.getContext('2d');
    if (!canvas || !context || !mat.map) return;
    context.fillStyle = PALETTE.white;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = PALETTE.black;
    context.font = '400 112px "Helvetica Neue", Arial, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 384, 106, 710);
    mat.map.needsUpdate = true;
  });
}

/** Fade each vehicle independently, without mutating materials shared with other bays. */
export function vehicleFader(root: THREE.Object3D, isolateMaterials = true) {
  const materials = new Map<
    THREE.Material,
    {
      material: THREE.Material;
      opacity: number;
      transparent: boolean;
      depthWrite: boolean;
    }
  >();
  const meshes: Array<{ mesh: THREE.Mesh; castShadow: boolean }> = [];
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    meshes.push({ mesh: object, castShadow: object.castShadow });
    const copy = (source: THREE.Material) => {
      if (!materials.has(source))
        materials.set(source, {
          material: isolateMaterials ? source.clone() : source,
          opacity: source.opacity,
          transparent: source.transparent,
          depthWrite: source.depthWrite,
        });
      return materials.get(source)!.material;
    };
    object.material = Array.isArray(object.material)
      ? object.material.map(copy)
      : copy(object.material);
  });
  let previous = -1;
  return (opacity: number) => {
    if (opacity === previous) return;
    previous = opacity;
    for (const entry of materials.values()) {
      const transparent = opacity < 1 || entry.transparent;
      if (entry.material.transparent !== transparent) entry.material.needsUpdate = true;
      entry.material.transparent = transparent;
      entry.material.opacity = entry.opacity * opacity;
      entry.material.depthWrite = opacity === 1 && entry.depthWrite;
    }
    meshes.forEach(({ mesh, castShadow }) => {
      mesh.castShadow = castShadow && opacity > 0.98;
    });
  };
}

export function disposeVehicleAsset(object: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(),
    materials = new Set<THREE.Material>(),
    textures = new Set<THREE.Texture>();
  object.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      geometries.add(node.geometry);
      (Array.isArray(node.material) ? node.material : [node.material]).forEach((mat) =>
        materials.add(mat),
      );
    }
  });
  materials.forEach((mat) => {
    Object.values(mat).forEach((value) => {
      if (value instanceof THREE.Texture) textures.add(value);
    });
    mat.dispose();
  });
  geometries.forEach((geometry) => geometry.dispose());
  textures.forEach((texture) => texture.dispose());
}
