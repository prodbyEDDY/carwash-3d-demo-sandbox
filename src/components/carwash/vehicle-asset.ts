import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { PALETTE, label } from './model-kit';

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
  const template = new THREE.Group();
  template.add(source);
  if (signal.aborted) {
    disposeVehicleAsset(template);
    throw new DOMException('Aborted', 'AbortError');
  }
  return template;
}

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
    const plate = label(
      white ? '728 AKM 02' : '559 BJV 05',
      0.53,
      0.115,
      PALETTE.white,
      PALETTE.black,
    );
    plate.position.set(0, 0.53, z);
    plate.name = 'session-license-plate';
    if (z < 0) plate.rotation.y = Math.PI;
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
