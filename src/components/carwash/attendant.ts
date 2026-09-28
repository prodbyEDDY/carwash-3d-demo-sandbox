import * as THREE from 'three';
import { PALETTE as P, box, material, mesh, rod, tube, type Vec3 } from './model-kit';

/** Human proportions in metres, facing +X toward the vehicle. */
export function buildAttendant() {
  const worker = new THREE.Group();
  const jacket = material(P.blue, 0.92, 0),
    trousers = material(P.cloth, 0.96, 0);
  const skin = material(P.skin, 0.85, 0),
    rubber = material(P.rubber, 0.93, 0);
  const gloves = material(P.graphite, 0.86, 0),
    trim = material(P.steel, 0.65, 0.1);
  const ellipsoid = (parent: THREE.Object3D, at: Vec3, scale: Vec3, mat: THREE.Material) => {
    const shape = mesh(parent, new THREE.SphereGeometry(1, 24, 16), mat, at);
    shape.scale.set(...scale);
    return shape;
  };
  const limb = (
    parent: THREE.Object3D,
    a: Vec3,
    b: Vec3,
    top: number,
    bottom: number,
    mat: THREE.Material,
  ) => {
    const from = new THREE.Vector3(...a),
      to = new THREE.Vector3(...b);
    const shape = mesh(
      parent,
      new THREE.CylinderGeometry(bottom, top, from.distanceTo(to), 16),
      mat,
      [0, 0, 0],
    );
    shape.position.copy(from).add(to).multiplyScalar(0.5);
    shape.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.sub(from).normalize());
    return shape;
  };
  // A staggered, planted stance; knees bend toward the car rather than out to the sides.
  for (const side of [-1, 1]) {
    const hip: Vec3 = [0, 0.91, side * 0.12];
    const knee: Vec3 = [0.06, 0.52, side * 0.17];
    const ankle: Vec3 = [-0.035 + side * 0.045, 0.17, side * 0.2];
    limb(worker, hip, knee, 0.105, 0.08, trousers);
    ellipsoid(worker, knee, [0.082, 0.095, 0.083], trousers);
    limb(worker, knee, ankle, 0.079, 0.059, trousers);
    box(worker, [0.28, 0.13, 0.155], rubber, [ankle[0] + 0.07, 0.075, ankle[2]], 0.045);
    box(worker, [0.29, 0.03, 0.16], gloves, [ankle[0] + 0.07, 0.02, ankle[2]], 0.025);
    limb(worker, [ankle[0], 0.12, ankle[2]], [ankle[0], 0.28, ankle[2]], 0.07, 0.072, rubber);
    box(worker, [0.08, 0.14, 0.035], trousers, [0.035, 0.78, side * 0.207], 0.012);
  }
  ellipsoid(worker, [0, 0.92, 0], [0.15, 0.13, 0.215], trousers);
  const upper = new THREE.Group();
  upper.position.y = 0.98;
  worker.add(upper);
  const torso = mesh(
    upper,
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.145, -0.04),
        new THREE.Vector2(0.17, 0.02),
        new THREE.Vector2(0.175, 0.16),
        new THREE.Vector2(0.205, 0.34),
        new THREE.Vector2(0.21, 0.39),
        new THREE.Vector2(0.15, 0.44),
        new THREE.Vector2(0.075, 0.46),
      ],
      28,
    ),
    jacket,
    [0, 0, 0],
  );
  torso.scale.set(0.72, 1, 1.12);
  // Tailoring, zip and chest pockets; no oversized facial or clothing details.
  rod(upper, [0.142, 0.025, 0], [0.143, 0.39, 0], 0.004, trim);
  for (const side of [-1, 1]) {
    box(upper, [0.018, 0.095, 0.088], jacket, [0.143, 0.29, side * 0.115], 0.008);
    rod(upper, [0.155, 0.33, side * 0.07], [0.155, 0.33, side * 0.16], 0.005, trim);
    ellipsoid(upper, [0, 0.37, side * 0.22], [0.1, 0.115, 0.09], jacket);
    const shoulder: Vec3 = [0.01, 0.36, side * 0.23];
    const elbow: Vec3 = [0.2, 0.15, side * 0.25];
    const wrist: Vec3 = [0.43 + side * 0.025, 0.105, side * 0.055];
    limb(upper, shoulder, elbow, 0.085, 0.064, jacket);
    ellipsoid(upper, elbow, [0.066, 0.07, 0.064], jacket);
    limb(upper, elbow, wrist, 0.062, 0.043, jacket);
    ellipsoid(upper, wrist, [0.055, 0.045, 0.043], gloves);
    // Slim reflective band on each upper sleeve.
    limb(upper, [0.09, 0.272, side * 0.238], [0.112, 0.248, side * 0.24], 0.071, 0.07, trim);
  }
  limb(upper, [0, 0.42, 0], [0.01, 0.52, 0], 0.064, 0.06, skin);
  const head = new THREE.Group();
  head.position.set(0.015, 0.65, 0);
  head.rotation.z = -0.1;
  upper.add(head);
  ellipsoid(head, [0, 0, 0], [0.103, 0.135, 0.104], skin);
  ellipsoid(head, [0.039, -0.07, 0], [0.075, 0.064, 0.085], skin);
  ellipsoid(head, [0.099, -0.012, 0], [0.034, 0.039, 0.027], skin);
  for (const side of [-1, 1]) {
    ellipsoid(head, [-0.006, -0.008, side * 0.104], [0.026, 0.04, 0.018], skin);
    ellipsoid(head, [0.09, 0.027, side * 0.047], [0.008, 0.008, 0.015], gloves);
    rod(head, [0.09, 0.048, side * 0.031], [0.084, 0.051, side * 0.065], 0.004, trousers);
  }
  const cap = mesh(
    head,
    new THREE.SphereGeometry(0.111, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    trousers,
    [0, 0.065, 0],
  );
  cap.scale.y = 0.63;
  box(head, [0.15, 0.014, 0.19], trousers, [0.091, 0.066, 0], 0.035);
  // Trigger, hand guard, lance and nozzle share the animated upper-body transform.
  box(upper, [0.18, 0.065, 0.065], gloves, [0.39, 0.105, 0.018], 0.015);
  rod(upper, [0.34, 0.1, 0.018], [0.32, 0.015, 0.018], 0.023, rubber);
  rod(upper, [0.44, 0.1, 0.018], [0.6, 0.075, 0.018], 0.012, trim);
  limb(upper, [0.58, 0.078, 0.018], [0.63, 0.07, 0.018], 0.018, 0.012, rubber);
  tube(
    worker,
    [
      [0.32, 1, 0.02],
      [0.03, 0.16, 0.4],
      [-0.21, 0.045, 0.82],
      [-0.27, 0.045, 1.65],
    ],
    0.016,
    rubber,
  );
  return { worker, upper };
}
