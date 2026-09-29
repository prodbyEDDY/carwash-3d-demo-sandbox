// @vitest-environment node
/**
 * The published vehicle glb bakes all four wheels into three merged meshes, so
 * splitVehicleWheels re-cuts them per corner. These checks guard the split:
 * geometry must survive it intact, and each pivot must sit on the real axle.
 */
import { readFileSync } from 'node:fs';

// The asset ships WebP textures; GLTFLoader only needs these two to reach them headless.
globalThis.self = globalThis as never;
if (!('createImageBitmap' in globalThis)) {
  (globalThis as { createImageBitmap?: unknown }).createImageBitmap = async () => ({
    width: 1,
    height: 1,
    close() {},
  });
}

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { loadVehicleAsset, vehicleWheels } from '../src/components/carwash/vehicle-asset';

const WHEEL_NODE = 'WHeelsandrims_2';
const bytes = readFileSync('public/models/carwash/vehicle.glb');
const glbBuffer = () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

function rawWheelTriangles() {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  return loader.parseAsync(glbBuffer(), '');
}

function triangleCount(root: THREE.Object3D) {
  let total = 0;
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) total += (object.geometry.index?.count ?? 0) / 3;
  });
  return total;
}

describe('vehicle asset wheels', () => {
  beforeAll(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, arrayBuffer: async () => glbBuffer() })),
    );
  });

  it('exposes one pivot per corner', async () => {
    const template = await loadVehicleAsset(new AbortController().signal);
    expect(vehicleWheels(template)).toHaveLength(4);
  });

  it('keeps every triangle of the merged wheel meshes', async () => {
    const gltf = await rawWheelTriangles();
    const merged = gltf.scene.getObjectByName(WHEEL_NODE)!;
    const template = await loadVehicleAsset(new AbortController().signal);
    const split = template.getObjectByName(WHEEL_NODE)!;
    expect(triangleCount(split)).toBe(triangleCount(merged));
  });

  it('centres every corner on its axle so rotation spins instead of wobbling', async () => {
    const template = await loadVehicleAsset(new AbortController().signal);
    for (const wheel of vehicleWheels(template)) {
      // The tyre is rotationally symmetric, so its box must straddle the pivot origin.
      const tyre = wheel.children.find((child) => {
        if (!(child instanceof THREE.Mesh)) return false;
        const material = Array.isArray(child.material) ? child.material[0] : child.material;
        return material?.name.toLowerCase().includes('m8rim001');
      }) as THREE.Mesh;
      const box = new THREE.Box3();
      const point = new THREE.Vector3();
      const position = tyre.geometry.attributes.position;
      for (let i = 0; i < position.count; i++)
        box.expandByPoint(point.fromBufferAttribute(position, i));
      const centre = box.getCenter(new THREE.Vector3());
      expect(Math.abs(centre.y)).toBeLessThan(0.02);
      expect(Math.abs(centre.z)).toBeLessThan(0.02);
    }
  });

  it('leaves the four wheels where the merged asset put them', async () => {
    const template = await loadVehicleAsset(new AbortController().signal);
    template.updateMatrixWorld(true);
    const expected: Record<string, [number, number]> = {
      lf: [-0.798, 1.554],
      rf: [0.799, 1.554],
      lb: [-0.827, -1.336],
      rb: [0.827, -1.336],
    };
    const seen: string[] = [];
    for (const wheel of vehicleWheels(template)) {
      const box = new THREE.Box3().setFromObject(wheel);
      const centre = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const key = `${centre.x < 0 ? 'l' : 'r'}${centre.z > 0 ? 'f' : 'b'}`;
      seen.push(key);
      expect(centre.x).toBeCloseTo(expected[key]![0], 1);
      expect(centre.z).toBeCloseTo(expected[key]![1], 1);
      // One corner alone: thin along the axle, full diameter across it.
      expect(size.x).toBeCloseTo(0.3, 1);
      expect(size.y).toBeCloseTo(0.75, 1);
      expect(size.z).toBeCloseTo(0.75, 1);
    }
    expect(seen.sort()).toEqual(['lb', 'lf', 'rb', 'rf']);
  });

  it('spins a corner in place instead of swinging it around the car', async () => {
    const template = await loadVehicleAsset(new AbortController().signal);
    template.updateMatrixWorld(true);
    const before = new THREE.Box3();
    for (const wheel of vehicleWheels(template)) before.union(new THREE.Box3().setFromObject(wheel));
    const beforeCentre = before.getCenter(new THREE.Vector3());

    for (const wheel of vehicleWheels(template)) wheel.rotation.x += Math.PI / 3;
    template.updateMatrixWorld(true);

    const after = new THREE.Box3();
    for (const wheel of vehicleWheels(template)) after.union(new THREE.Box3().setFromObject(wheel));
    const afterCentre = after.getCenter(new THREE.Vector3());
    // A wheel on its own axle keeps its place; an off-centre pivot would swing the body.
    expect(afterCentre.x).toBeCloseTo(beforeCentre.x, 2);
    expect(afterCentre.y).toBeCloseTo(beforeCentre.y, 2);
    expect(afterCentre.z).toBeCloseTo(beforeCentre.z, 2);

    // Turning a round wheel grows its axis-aligned box, so compare what must not change:
    // every vertex keeps its distance to the axle.
    const other = await loadVehicleAsset(new AbortController().signal);
    const reach = (template: THREE.Object3D, rotated: boolean) => {
      const wheel = vehicleWheels(template)[0]!;
      if (rotated) wheel.rotation.x += Math.PI / 3;
      let longest = 0;
      const point = new THREE.Vector3();
      wheel.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const position = object.geometry.attributes.position;
        for (let i = 0; i < position.count; i++)
          longest = Math.max(longest, point.fromBufferAttribute(position, i).length());
      });
      return longest;
    };
    expect(reach(other, true)).toBeCloseTo(reach(other, false), 3);
  });
});
