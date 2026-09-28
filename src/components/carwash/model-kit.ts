import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/** Scene material tokens live here, independently of the surrounding UI theme. */
export const PALETTE = {
  backdrop: '#d7dfe3',
  ivory: '#e4e1da',
  panel: '#d2d0c8',
  grout: '#9d9f9c',
  concrete: '#b9bcb8',
  graphite: '#394247',
  steel: '#929ea2',
  black: '#18232a',
  blue: '#1b507e',
  paint: '#145fa6',
  white: '#edf0ea',
  rubber: '#25292b',
  glass: '#263e48',
  warm: '#fff4da',
  green: '#56a889',
  cyan: '#57c0ed',
  red: '#a8423b',
  skin: '#b7957c',
  cloth: '#263e52',
  foliage: '#72815a',
} as const;
export type Vec3 = [number, number, number];
export const material = (color: string, roughness = 0.5, metalness = 0.1) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });
export function mesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  mat: THREE.Material,
  at: Vec3,
  shadow = true,
) {
  const item = new THREE.Mesh(geometry, mat);
  item.position.set(...at);
  item.castShadow = shadow;
  item.receiveShadow = true;
  parent.add(item);
  return item;
}
export function box(parent: THREE.Object3D, size: Vec3, mat: THREE.Material, at: Vec3, radius = 0) {
  return mesh(
    parent,
    radius ? new RoundedBoxGeometry(...size, 2, radius) : new THREE.BoxGeometry(...size),
    mat,
    at,
  );
}
export function tube(
  parent: THREE.Object3D,
  points: Vec3[],
  radius: number,
  mat: THREE.Material,
  segments = 28,
) {
  return mesh(
    parent,
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))),
      segments,
      radius,
      6,
      false,
    ),
    mat,
    [0, 0, 0],
  );
}
export function rod(
  parent: THREE.Object3D,
  from: Vec3,
  to: Vec3,
  radius: number,
  mat: THREE.Material,
) {
  const a = new THREE.Vector3(...from),
    b = new THREE.Vector3(...to);
  const item = mesh(
    parent,
    new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), 8),
    mat,
    [0, 0, 0],
  );
  item.position.copy(a).add(b).multiplyScalar(0.5);
  item.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
  return item;
}
export function surface(parent: THREE.Object3D, points: Vec3[], mat: THREE.Material) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
  const indices: number[] = [];
  for (let i = 1; i < points.length - 1; i++) indices.push(0, i, i + 1);
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return mesh(parent, geometry, mat, [0, 0, 0]);
}
export function label(
  text: string,
  width: number,
  height: number,
  background = PALETTE.blue as string,
  color = PALETTE.white as string,
) {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 192;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, 768, 192);
  ctx.fillStyle = color;
  ctx.font = '400 112px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 384, 106, 710);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
}
/** Deterministic mineral texture; no external texture fetches or per-frame canvas work. */
export function concreteTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  let seed = 923;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  ctx.fillStyle = PALETTE.concrete;
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 130; i++) {
    const x = random() * 512,
      y = random() * 512,
      r = 15 + random() * 95;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, i % 2 ? 'rgba(66,76,72,.1)' : 'rgba(255,255,250,.14)');
    g.addColorStop(1, 'rgba(120,128,123,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 18000; i++) {
    ctx.fillStyle = i % 2 ? 'rgba(43,52,51,.08)' : 'rgba(255,255,255,.12)';
    ctx.fillRect(random() * 512, random() * 512, random() * 1.4, random() * 1.5);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 4);
  texture.anisotropy = 4;
  return texture;
}

/** Smooth continuous automotive shell, built from shaped transverse sections. */
function shell(sections: Array<[number, number, number, number]>) {
  const vertices: number[] = [],
    indices: number[] = [];
  const sides = 24;
  sections.forEach(([z, w, low, high]) => {
    for (let j = 0; j <= sides; j++) {
      const a = (j / sides) * Math.PI * 2;
      vertices.push(Math.sin(a) * w, (low + high) / 2 + (Math.cos(a) * (high - low)) / 2, z);
    }
  });
  for (let i = 0; i < sections.length - 1; i++)
    for (let j = 0; j < sides; j++) {
      const a = i * (sides + 1) + j,
        b = a + sides + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function buildVehicle(suv = false) {
  const group = new THREE.Group();
  const P = PALETTE;
  const paint = new THREE.MeshPhysicalMaterial({
    color: suv ? P.white : P.paint,
    metalness: 0.65,
    roughness: 0.23,
    clearcoat: 1,
    clearcoatRoughness: 0.14,
  });
  const chrome = material(P.steel, 0.22, 0.85),
    trim = material(P.black, 0.43, 0.3),
    rubber = material(P.rubber, 0.88, 0);
  const glass = new THREE.MeshPhysicalMaterial({
    color: P.glass,
    metalness: 0.28,
    roughness: 0.12,
    clearcoat: 1,
    side: THREE.DoubleSide,
  });
  const bodyLift = suv ? 0.13 : 0;
  const body = mesh(
    group,
    shell([
      [-2.4, 0.56, 0.46, 0.76],
      [-2.32, 0.84, 0.37, 0.93],
      [-1.7, 0.92, 0.32, 1.03],
      [-0.8, 0.92, 0.3, 1.04],
      [0.4, 0.91, 0.3, 1.02],
      [1.3, 0.92, 0.34, 0.99],
      [1.95, 0.87, 0.4, 0.87],
      [2.34, 0.79, 0.43, 0.72],
      [2.42, 0.52, 0.49, 0.65],
    ]),
    paint,
    [0, bodyLift, 0],
  );
  body.name = 'continuous-car-body';
  const roofY = suv ? 1.73 : 1.48,
    frontRoofZ = suv ? 0.57 : 0.35,
    rearRoofZ = suv ? -1.35 : -0.75;
  const bottomY = 1.01 + bodyLift,
    roofW = suv ? 0.75 : 0.7;
  // Roof, sloping windscreen and rear screen share identical vertices.
  surface(
    group,
    [
      [-roofW, roofY, frontRoofZ],
      [roofW, roofY, frontRoofZ],
      [roofW, roofY, rearRoofZ],
      [-roofW, roofY, rearRoofZ],
    ],
    paint,
  ).material.side = THREE.DoubleSide;
  surface(
    group,
    [
      [-0.82, bottomY, 1.13],
      [0.82, bottomY, 1.13],
      [roofW, roofY, frontRoofZ],
      [-roofW, roofY, frontRoofZ],
    ],
    glass,
  );
  surface(
    group,
    [
      [-0.82, bottomY, -1.74],
      [-roofW, roofY, rearRoofZ],
      [roofW, roofY, rearRoofZ],
      [0.82, bottomY, -1.74],
    ],
    glass,
  );
  for (const side of [-1, 1]) {
    const p: Vec3[] = [
      [side * 0.845, bottomY, 1.12],
      [side * roofW, roofY, frontRoofZ],
      [side * roofW, roofY, rearRoofZ],
      [side * 0.845, bottomY, -1.73],
    ];
    surface(group, p, glass);
    for (let i = 0; i < 4; i++) rod(group, p[i]!, p[(i + 1) % 4]!, 0.025, i === 3 ? chrome : paint);
    rod(group, [side * 0.844, bottomY, -0.43], [side * roofW, roofY, -0.43], 0.044, trim);
    for (const z of [0.28, -1.05]) {
      box(group, [0.036, 0.045, 0.19], chrome, [side * 0.92, 0.91 + bodyLift, z], 0.015);
      tube(
        group,
        [
          [side * 0.925, 0.48 + bodyLift, z - 0.32],
          [side * 0.925, 0.78 + bodyLift, z - 0.36],
          [side * 0.85, 1.02 + bodyLift, z - 0.38],
        ],
        0.008,
        trim,
        10,
      );
    }
    rod(
      group,
      [side * 0.77, 1.12 + bodyLift, 0.78],
      [side * 1.03, 1.08 + bodyLift, 0.84],
      0.03,
      trim,
    );
    box(group, [0.23, 0.12, 0.26], paint, [side * 1.07, 1.13 + bodyLift, 0.82], 0.055);
    box(group, [0.03, 0.085, 0.19], glass, [side * 1.19, 1.135 + bodyLift, 0.8], 0.02);
    rod(group, [side * 0.89, 0.37, -1.67], [side * 0.89, 0.37, 1.64], 0.04, trim);
  }
  // Grille follows the front bumper; paired tapered lamp housings.
  box(group, [1.24, 0.28, 0.09], trim, [0, 0.54 + bodyLift, 2.36], 0.075);
  for (let i = 0; i < 6; i++)
    box(group, [1.13, 0.014, 0.015], chrome, [0, 0.43 + bodyLift + i * 0.044, 2.411]);
  const headlamp = new THREE.MeshStandardMaterial({
    color: P.white,
    emissive: P.warm,
    emissiveIntensity: 0.7,
    metalness: 0.25,
    roughness: 0.18,
  });
  const tail = new THREE.MeshStandardMaterial({
    color: P.red,
    emissive: P.red,
    emissiveIntensity: 0.5,
    roughness: 0.2,
  });
  for (const side of [-1, 1]) {
    const lamp = box(
      group,
      [0.47, 0.11, 0.12],
      headlamp,
      [side * 0.63, 0.8 + bodyLift, 2.17],
      0.035,
    );
    lamp.rotation.y = side * -0.25;
    box(group, [0.48, 0.12, 0.065], tail, [side * 0.61, 0.85 + bodyLift, -2.31], 0.024);
    box(group, [0.12, 0.05, 0.07], headlamp, [side * 0.61, 0.74 + bodyLift, -2.32], 0.015);
    const exhaust = mesh(group, new THREE.CylinderGeometry(0.06, 0.06, 0.18, 16), chrome, [
      side * 0.56,
      0.35,
      -2.38,
    ]);
    exhaust.rotation.x = Math.PI / 2;
  }
  for (const z of [-2.405, 2.425]) {
    const plate = label(suv ? '728 AKM 02' : '559 BJV 05', 0.56, 0.13, P.white, P.black);
    plate.position.set(0, 0.57 + bodyLift, z);
    if (z < 0) plate.rotation.y = Math.PI;
    group.add(plate);
  }
  // Detailed alloy wheels, brake discs, five paired spokes and wheel arch trim.
  const wheels: THREE.Group[] = [];
  for (const x of [-0.94, 0.94])
    for (const z of [-1.5, 1.48]) {
      const wheel = new THREE.Group();
      wheel.position.set(x, 0.37, z);
      group.add(wheel);
      wheels.push(wheel);
      const tyre = mesh(wheel, new THREE.TorusGeometry(0.279, 0.09, 12, 40), rubber, [0, 0, 0]);
      tyre.rotation.y = Math.PI / 2;
      const rim = mesh(
        wheel,
        new THREE.CylinderGeometry(0.252, 0.252, 0.14, 40),
        chrome,
        [0, 0, 0],
      );
      rim.rotation.z = Math.PI / 2;
      const face = x > 0 ? 0.085 : -0.085;
      const disc = mesh(wheel, new THREE.CylinderGeometry(0.204, 0.204, 0.015, 32), trim, [
        face,
        0,
        0,
      ]);
      disc.rotation.z = Math.PI / 2;
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5;
        rod(
          wheel,
          [face, 0.045 * Math.cos(a), 0.045 * Math.sin(a)],
          [face, 0.23 * Math.cos(a + 0.14), 0.23 * Math.sin(a + 0.14)],
          0.018,
          chrome,
        );
      }
      const hub = mesh(wheel, new THREE.SphereGeometry(0.055, 12, 8), chrome, [face, 0, 0]);
      hub.scale.x = 0.3;
      const archPoints: Vec3[] = Array.from({ length: 17 }, (_, i) => {
        const a = (i / 16) * Math.PI;
        return [x, 0.37 + Math.sin(a) * 0.397, z + Math.cos(a) * 0.397];
      });
      tube(group, archPoints, 0.035, paint, 24);
    }
  if (suv)
    for (const x of [-0.66, 0.66])
      rod(group, [x, roofY + 0.04, -1.25], [x, roofY + 0.04, 0.5], 0.025, chrome);
  // Soft tyre contact, without a floating opaque rectangle.
  const contactCanvas = document.createElement('canvas');
  contactCanvas.width = contactCanvas.height = 64;
  const ctx = contactCanvas.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 5, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,.4)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const contact = mesh(
    group,
    new THREE.PlaneGeometry(2.5, 5.2),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(contactCanvas),
      transparent: true,
      depthWrite: false,
    }),
    [0, 0.016, 0],
    false,
  );
  contact.rotation.x = -Math.PI / 2;
  contact.name = 'vehicle-contact-shadow';
  return { group, wheels };
}
