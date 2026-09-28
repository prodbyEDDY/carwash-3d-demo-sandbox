import * as THREE from 'three';
import { buildAttendant } from './attendant';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { CARWASH_LAYOUT as L, bayCenter } from '../../lib/carwash-layout';
import { PALETTE as P, box, buildVehicle, label, material, mesh, rod, tube } from './model-kit';

function tag(object: THREE.Object3D, hotspot: string) {
  object.userData.hotspot = hotspot;
  return object;
}

export function buildCarWash() {
  const root = new THREE.Group();
  const ivory = material(P.ivory, 0.72),
    panel = material(P.panel, 0.6),
    steel = material(P.steel, 0.3, 0.75);
  const graphite = material(P.graphite, 0.36, 0.6),
    blue = material(P.blue, 0.32, 0.45),
    black = material(P.black, 0.7);
  const white = material(P.white, 0.35),
    rubber = material(P.rubber, 0.9),
    foliage = material(P.foliage, 0.88);
  const textureLoader = new THREE.TextureLoader();
  const loadTexture = (file: string, color = false) => {
    const texture = textureLoader.load(`/models/carwash/${file}`);
    if (color) texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(8, 6);
    texture.anisotropy = 4;
    return texture;
  };
  const concreteMap = loadTexture('concrete-Diffuse.jpg', true);
  const normalMap = loadTexture('concrete-nor_gl.jpg');
  const roughnessMap = loadTexture('concrete-Rough.jpg');
  const bayMap = concreteMap.clone();
  bayMap.repeat.set(2, 3.6);
  const bayNormal = normalMap.clone();
  bayNormal.repeat.set(2, 3.6);
  const bayRoughness = roughnessMap.clone();
  bayRoughness.repeat.set(2, 3.6);
  const concrete = new THREE.MeshStandardMaterial({
    map: concreteMap,
    normalMap,
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughnessMap,
    roughness: 0.82,
  });
  const wet = new THREE.MeshPhysicalMaterial({
    map: bayMap,
    normalMap: bayNormal,
    normalScale: new THREE.Vector2(0.35, 0.35),
    roughnessMap: bayRoughness,
    roughness: 0.52,
    metalness: 0.1,
    clearcoat: 0.55,
    clearcoatRoughness: 0.25,
  });
  const light = new THREE.MeshStandardMaterial({
    color: P.warm,
    emissive: P.warm,
    emissiveIntensity: 2,
  });
  const base = box(root, [21.5, 0.32, 15.6], concrete, [1.3, -0.2, 2.45], 0.32);
  base.name = 'architectural-plinth';
  // Concrete joints continue through the forecourt, drains across the entrances.
  const pavingJoints = new THREE.Group();
  root.add(pavingJoints);
  for (let x = -8.4; x < 11.4; x += 2.2)
    box(pavingJoints, [0.014, 0.005, 14.7], material(P.grout, 0.9), [x, -0.034, 2.35]);
  for (let z = -4.1; z < 10; z += 2.2)
    box(pavingJoints, [20.8, 0.005, 0.014], material(P.grout, 0.9), [1.3, -0.033, z]);

  const reflection = new Reflector(new THREE.PlaneGeometry(20.5, 14.6), {
    textureWidth: 768,
    textureHeight: 512,
    color: P.concrete,
    clipBias: 0.003,
  });
  reflection.rotation.x = -Math.PI / 2;
  reflection.position.set(1.3, -0.026, 2.35);
  const reflectionMaterial = reflection.material as THREE.ShaderMaterial;
  reflectionMaterial.transparent = true;
  reflectionMaterial.depthWrite = false;
  reflectionMaterial.fragmentShader = reflectionMaterial.fragmentShader.replace(
    'vec4( blendOverlay( base.rgb, color ), 1.0 )',
    'vec4( blendOverlay( base.rgb, color ), 0.065 )',
  );
  reflection.name = 'wet-concrete-reflection';
  root.add(reflection);

  const bays = Array.from({ length: 4 }, (_, index) => {
    const group = new THREE.Group();
    root.add(group);
    const back = new THREE.Group();
    group.add(back);
    box(back, [L.bayWidth, 3.6, 0.13], panel, [0, 1.8, L.backZ]);
    for (let y = 0.55; y < 3.5; y += 0.55)
      box(back, [L.bayWidth, 0.014, 0.012], material(P.grout), [0, y, L.backZ + 0.071]);
    for (const x of [-1.03, 1.03])
      box(back, [0.012, 3.6, 0.014], material(P.grout), [x, 1.8, L.backZ + 0.073]);
    box(group, [L.bayWidth - 0.08, 0.035, 7.5], wet, [0, -0.005, -0.35]);
    box(group, [L.bayWidth, 0.37, 0.15], blue, [0, 3.42, L.frontZ]);
    box(group, [L.bayWidth, 0.045, 0.22], steel, [0, 3.635, L.frontZ]);
    const number = label(`0${index + 1}`, 0.65, 0.23);
    number.position.set(0, 3.42, L.frontZ + 0.078);
    group.add(number);
    for (const x of [-1.9, 1.9]) {
      box(group, [0.045, 0.012, 7.2], blue, [x, 0.022, -0.25]);
      box(group, [0.1, 0.1, 7.7], graphite, [x, 3.57, -0.35]);
      box(group, [0.055, 0.035, 6.9], light, [x, 3.49, -0.35]);
    }
    // Floor grilles: instancing keeps the detail inexpensive.
    box(group, [0.35, 0.022, 6.2], black, [0, 0.022, -0.2]);
    const grilles = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.025, 0.026), steel, 52);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 52; i++) {
      dummy.position.set(0, 0.04, -3.2 + i * 0.12);
      dummy.updateMatrix();
      grilles.setMatrixAt(i, dummy.matrix);
    }
    group.add(grilles);
    box(group, [L.bayWidth, 0.04, 0.18], black, [0, 0.025, 3.58]);
    const frontGrilles = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.026, 0.045, 0.18),
      steel,
      54,
    );
    for (let i = 0; i < 54; i++) {
      dummy.position.set(-2 + i * 0.075, 0.045, 3.58);
      dummy.updateMatrix();
      frontGrilles.setMatrixAt(i, dummy.matrix);
    }
    group.add(frontGrilles);
    // One fixed camera on the rear wall, lens facing the incoming front plate.
    const camera = new THREE.Group();
    camera.position.set(0.7, L.cameraY, L.backZ + 0.15);
    group.add(camera);
    tag(camera, 'camera');
    rod(camera, [0, -2.2, 0], [0, 1.1, 0], 0.032, graphite);
    box(camera, [0.15, 0.22, 0.07], steel, [0, 0.03, 0], 0.02);
    rod(camera, [0, 0.02, 0], [0, -0.02, 0.26], 0.037, steel);
    const head = new THREE.Group();
    head.position.set(0, -0.04, 0.3);
    head.rotation.x = 1.05;
    camera.add(head);
    box(head, [0.25, 0.19, 0.38], white, [0, 0, 0], 0.045);
    box(head, [0.29, 0.022, 0.43], white, [0, 0.105, 0.025], 0.009);
    const lens = mesh(
      head,
      new THREE.CylinderGeometry(0.07, 0.07, 0.025, 24),
      black,
      [0, 0, 0.203],
    );
    lens.rotation.x = Math.PI / 2;
    const lensGlass = mesh(
      head,
      new THREE.CircleGeometry(0.043, 24),
      material(P.glass, 0.08, 0.8),
      [0, 0, 0.218],
    );
    const cameraLed = mesh(head, new THREE.SphereGeometry(0.012, 8, 6), light, [0.092, 0, 0.203]);
    // Visible conduit goes up to the rear cable tray, then to the operator room.
    tube(
      back,
      [
        [0.7, 2.2, L.backZ + 0.1],
        [0.7, 3.25, L.backZ + 0.1],
        [1.99, 3.25, L.backZ + 0.1],
      ],
      0.016,
      graphite,
      8,
    );
    box(back, [L.bayWidth, 0.075, 0.08], steel, [0, 3.3, L.backZ + 0.08]);
    // Hose reel, cabinet, pressure unit and trigger wand.
    const equipment = new THREE.Group();
    group.add(equipment);
    rod(equipment, [-1.96, 0.05, -2.5], [-1.96, 2.7, -2.5], 0.025, steel);
    rod(equipment, [-1.96, 2.3, -2.5], [-1.75, 2.3, -2.5], 0.025, steel);
    box(equipment, [0.25, 0.7, 0.36], blue, [-1.77, 1.25, -2.4], 0.045);
    box(equipment, [0.26, 0.27, 0.23], steel, [-1.77, 1.28, -2.16], 0.025);
    for (let r = 0; r < 4; r++) {
      const ring = mesh(
        equipment,
        new THREE.TorusGeometry(0.28 - r * 0.042, 0.023, 8, 32),
        blue,
        [-1.78, 2.3, -2.5],
      );
      ring.rotation.y = Math.PI / 2;
    }
    const spool = mesh(
      equipment,
      new THREE.CylinderGeometry(0.33, 0.33, 0.18, 32),
      graphite,
      [-1.89, 2.3, -2.5],
    );
    spool.rotation.z = Math.PI / 2;
    tube(
      equipment,
      [
        [-1.68, 2.15, -2.5],
        [-1.9, 0.3, -2.1],
        [-1.9, 0.13, -1.9],
        [-1.92, 0.32, -1.8],
        [-1.94, 1.45, -1.9],
      ],
      0.022,
      rubber,
    );
    // Keep the wall-mounted wand behind the attendant's working corridor.
    rod(equipment, [-1.94, 0.7, -1.9], [-1.94, 1.65, -1.9], 0.024, steel);
    const tank = mesh(
      equipment,
      new THREE.CylinderGeometry(0.21, 0.21, 0.72, 24),
      blue,
      [-1.64, 0.39, -3.22],
    );
    mesh(equipment, new THREE.SphereGeometry(0.21, 20, 12), steel, [-1.64, 0.75, -3.22]).scale.y =
      0.3;
    for (const x of [-1.86, -1.45])
      mesh(equipment, new THREE.SphereGeometry(0.07, 8, 6), black, [x, 0.13, -3.22]);
    tag(equipment, 'washer');
    void tank;
    const car = buildVehicle(index === 0);
    group.add(car.group);
    car.group.rotation.y = Math.PI;
    car.group.position.z = L.parkZ;
    tag(car.group, 'box');
    const lampMat = new THREE.MeshStandardMaterial({
      color: P.green,
      emissive: P.green,
      emissiveIntensity: 0.6,
    });
    box(group, [0.22, 0.035, 0.06], lampMat, [0.75, 3.42, L.frontZ + 0.085], 0.017);
    // A ground zone and plate corners explain recognition, instead of giant cones.
    const zoneMat = new THREE.MeshBasicMaterial({
      color: P.cyan,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const zone = mesh(
      group,
      new THREE.PlaneGeometry(2.35, 5.4),
      zoneMat,
      [0, 0.06, L.parkZ],
      false,
    );
    zone.rotation.x = -Math.PI / 2;
    const scanner = new THREE.Group();
    car.group.add(scanner);
    scanner.position.set(0, 0.57, 2.46);
    const scanMat = new THREE.MeshBasicMaterial({
      color: P.cyan,
      toneMapped: false,
    });
    for (const x of [-0.34, 0.34])
      for (const y of [-0.105, 0.105]) {
        box(scanner, [0.105, 0.012, 0.012], scanMat, [x - Math.sign(x) * 0.04, y, 0]);
        box(scanner, [0.012, 0.065, 0.012], scanMat, [x, y - Math.sign(y) * 0.027, 0]);
      }
    scanner.visible = false;
    const cameraGlowMat = new THREE.MeshBasicMaterial({
      color: P.cyan,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      toneMapped: false,
    });
    const cameraGlow = mesh(
      head,
      new THREE.TorusGeometry(0.105, 0.014, 8, 40),
      cameraGlowMat,
      [0, 0, 0.23],
      false,
    );
    const cameraHalo = mesh(
      head,
      new THREE.RingGeometry(0.13, 0.17, 40),
      cameraGlowMat,
      [0, 0, 0.235],
      false,
    );
    cameraHalo.material.side = THREE.DoubleSide;
    cameraGlow.visible = cameraHalo.visible = false;
    const scanLine = box(scanner, [0.58, 0.008, 0.012], scanMat, [0, 0, 0]);

    const { worker, upper: workerUpper } = buildAttendant();
    worker.position.set(-1.68, 0.06, L.parkZ);
    group.add(worker);
    tag(worker, 'washer');
    const particlePositions = new Float32Array(90 * 3);
    const sprayGeometry = new THREE.BufferGeometry();
    sprayGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const spray = new THREE.Points(
      sprayGeometry,
      new THREE.PointsMaterial({
        color: P.white,
        size: 0.032,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      }),
    );
    workerUpper.add(spray);
    spray.visible = false;
    return {
      group,
      back,
      camera,
      lensGlass,
      cameraLed,
      car,
      lampMat,
      zoneMat,
      scanner,
      scanLine,
      cameraGlow,
      cameraHalo,
      cameraGlowMat,
      worker,
      workerUpper,
      spray,
      particlePositions,
    };
  });

  const dividers = Array.from({ length: 5 }, () => {
    const group = new THREE.Group();
    root.add(group);
    const wall = new THREE.Group();
    group.add(wall);
    box(wall, [0.11, 3.55, 7.7], ivory, [0, 1.775, -0.35]);
    for (let y = 0.55; y < 3.5; y += 0.55)
      for (const x of [-0.062, 0.062])
        box(wall, [0.006, 0.012, 7.55], material(P.grout), [x, y, -0.35]);
    for (const z of [L.backZ, L.frontZ]) box(group, [0.18, 3.7, 0.2], graphite, [0, 1.85, z]);
    return { group, wall };
  });

  // Glazed operator room, contiguous with the right-hand end of the wash.
  const office = new THREE.Group();
  root.add(office);
  const officeBack = box(office, [3.35, 3.6, 0.14], ivory, [0, 1.8, L.backZ]);

  box(office, [3.35, 0.025, 7.65], material('#b6a48c', 0.7), [0, 0.015, -0.3]);
  for (const z of [L.backZ, L.frontZ])
    for (const x of [-1.68, 1.68]) box(office, [0.12, 3.6, 0.12], graphite, [x, 1.8, z]);
  const glazing = new THREE.MeshPhysicalMaterial({
    color: P.white,
    roughness: 0.1,
    metalness: 0.1,
    transparent: true,
    opacity: 0.1,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const frontGlass = box(office, [3.25, 3.1, 0.018], glazing, [0, 1.56, L.frontZ]);
  frontGlass.castShadow = false;
  const sideGlass = box(office, [0.018, 3.2, 7.6], glazing, [1.68, 1.6, -0.35]);
  sideGlass.castShadow = false;
  for (const x of [-0.6, 0.7]) box(office, [0.07, 3.4, 0.07], graphite, [x, 1.7, L.frontZ]);
  box(office, [3.4, 0.22, 0.17], ivory, [0, 3.5, L.frontZ]);
  rod(office, [0.56, 1.2, L.frontZ + 0.07], [0.56, 1.53, L.frontZ + 0.07], 0.018, steel);
  const officeLabel = label('ORIONIX', 1.6, 0.18, P.ivory, P.graphite);
  officeLabel.position.set(0, 3.51, L.frontZ + 0.09);
  office.add(officeLabel);
  box(office, [1.8, 0.07, 0.7], material('#aa9479', 0.5), [0, 0.8, -1.3], 0.03);
  for (const x of [-0.77, 0.77])
    for (const z of [-1.56, -1.05]) box(office, [0.055, 0.8, 0.055], graphite, [x, 0.4, z]);
  const screen = box(office, [1.05, 0.64, 0.065], black, [-0.1, 1.23, -1.35], 0.028);
  tag(screen, 'tablet');
  box(office, [0.06, 0.22, 0.06], graphite, [-0.1, 0.93, -1.35]);
  box(office, [0.42, 0.018, 0.23], graphite, [-0.1, 0.85, -1.35], 0.02);
  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = 1024;
  screenCanvas.height = 640;
  const screenContext = screenCanvas.getContext('2d')!;
  let screenKey = '';
  const screenTexture = new THREE.CanvasTexture(screenCanvas);
  screenTexture.colorSpace = THREE.SRGBColorSpace;
  function updateMonitor(plate: string, status: string, focusBox: number, tone = 'info', occupied?: Array<string | null>) {
    const plates = occupied ?? Array.from({ length: 3 }, (_, i) => i + 1 === focusBox ? plate : null);
    const key = `${plates.join(':')}:${status}:${focusBox}:${tone}`;
    if (key === screenKey) return;
    screenKey = key;
    screenContext.fillStyle = P.white;
    screenContext.fillRect(0, 0, 1024, 640);
    screenContext.fillStyle = P.blue;
    screenContext.fillRect(0, 0, 1024, 90);
    screenContext.fillStyle = P.white;
    screenContext.font = '400 32px Arial';
    screenContext.fillText('ORIONIX  /  CAR CONTROL', 40, 57);
    screenContext.fillStyle = P.graphite;
    screenContext.font = '400 28px Arial';
    screenContext.fillText('LIVE SESSIONS', 40, 150);
    Array.from(
      { length: 3 },
      (_, i) => `${String(i + 1).padStart(2, '0')}   ${plates[i] ?? 'AVAILABLE'}`,
    ).forEach((text, index) => {
      screenContext.fillStyle = index + 1 === focusBox ? '#e0eaf3' : '#efefeb';
      screenContext.fillRect(36, 182 + index * 102, 952, 84);
      screenContext.fillStyle = P.graphite;
      screenContext.font = '400 30px Arial';
      screenContext.fillText(text, 65, 233 + index * 102);
      screenContext.fillStyle = plates[index] ? P.blue : P.green;
      screenContext.fillRect(770, 203 + index * 102, 170, 42);
      screenContext.fillStyle = P.white;
      screenContext.font = '400 20px Arial';
      screenContext.fillText(plates[index] ? 'ACTIVE' : 'READY', 784, 231 + index * 102);
    });
    screenContext.fillStyle = tone === 'warning' ? P.red : tone === 'success' ? P.green : P.blue;
    screenContext.font = '400 24px Arial';
    screenContext.fillText(status, 42, 564);
    screenTexture.needsUpdate = true;
  }
  updateMonitor('559 BJV 05', 'LIVE MONITORING', 2);
  const display = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95, 0.54),
    new THREE.MeshBasicMaterial({ map: screenTexture, toneMapped: false }),
  );
  display.position.set(-0.1, 1.23, -1.309);
  office.add(display);
  tag(display, 'tablet');
  const node = new THREE.Group();
  node.position.set(0.66, 0.94, -1.15);
  office.add(node);
  tag(node, 'node');
  box(node, [0.28, 0.16, 0.3], graphite, [0, 0, 0], 0.022);
  for (let i = 0; i < 8; i++) box(node, [0.016, 0.026, 0.27], black, [-0.11 + i * 0.031, 0.092, 0]);
  for (let i = 0; i < 3; i++)
    box(node, [0.038, 0.025, 0.012], steel, [-0.085 + i * 0.06, -0.022, 0.158]);
  const nodeLed = mesh(node, new THREE.SphereGeometry(0.012, 8, 6), light, [0.105, 0.021, 0.157]);
  const chair = new THREE.Group();
  chair.position.set(-0.15, 0, -0.3);
  office.add(chair);
  box(chair, [0.48, 0.1, 0.45], graphite, [0, 0.5, 0], 0.07);
  box(chair, [0.48, 0.53, 0.07], graphite, [0, 0.8, 0.2], 0.065);
  rod(chair, [0, 0.08, 0], [0, 0.49, 0], 0.035, steel);
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5;
    rod(chair, [0, 0.08, 0], [Math.sin(a) * 0.32, 0.065, Math.cos(a) * 0.32], 0.022, steel);
  }
  tube(
    office,
    [
      [0.66, 0.94, -1.3],
      [0.85, 0.72, -1.4],
      [1.24, 0.7, -3.99],
      [1.24, 3.27, -3.99],
      [-1.68, 3.27, -3.99],
    ],
    0.013,
    black,
  );
  const switchUnit = box(office, [0.75, 0.22, 0.1], graphite, [0.8, 2.78, L.backZ + 0.12], 0.015);
  tag(switchUnit, 'node');
  for (let i = 0; i < 8; i++)
    box(office, [0.042, 0.035, 0.015], steel, [0.53 + i * 0.08, 2.78, L.backZ + 0.18]);

  // Planters and grasses echo the references without bringing a landscape into the model.
  const planterGroups: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const planter = new THREE.Group();
    root.add(planter);
    planterGroups.push(planter);
    box(planter, [0.85, 0.42, 3.8], ivory, [0, 0.16, 0], 0.27);
    box(planter, [0.68, 0.018, 3.48], material('#5b6251', 0.95), [0, 0.38, 0], 0.17);
    for (let i = 0; i < 42; i++) {
      const z = -1.5 + (i % 7) * 0.5,
        x = ((i * 17) % 11) / 25 - 0.2,
        h = 0.34 + (i % 5) * 0.115;
      const leaf = mesh(
        planter,
        new THREE.ConeGeometry(0.042, h, 4),
        foliage,
        [x, 0.4 + h / 2, z],
        false,
      );
      leaf.rotation.z = side * 0.25 + Math.sin(i * 3) * 0.45;
      leaf.rotation.x = Math.cos(i * 2) * 0.4;
    }
  }
  const arrow = new THREE.Shape();
  arrow.moveTo(-0.065, 0);
  arrow.lineTo(0.065, 0);
  arrow.lineTo(0.065, 0.62);
  arrow.lineTo(0.26, 0.62);
  arrow.lineTo(0, 1);
  arrow.lineTo(-0.26, 0.62);
  arrow.lineTo(-0.065, 0.62);
  arrow.closePath();
  const direction = mesh(
    root,
    new THREE.ShapeGeometry(arrow),
    material(P.white, 0.75),
    [0, 0.03, 5.65],
    false,
  );
  direction.rotation.x = -Math.PI / 2;
  let currentCount = 0;
  function layout(count: number) {
    if (count === currentCount) return;
    currentCount = count;
    bays.forEach((bay, i) => {
      bay.group.visible = i < count;
      bay.group.position.x = bayCenter(i, count);
    });
    dividers.forEach((d, i) => {
      d.group.visible = i <= count;
      d.group.position.x = bayCenter(0, count) - L.bayWidth / 2 + i * L.bayWidth;
    });
    office.position.x = (count * L.bayWidth) / 2 + 1.75;
    planterGroups[0]!.position.set((-count * L.bayWidth) / 2 - 0.65, 0, 1.4);
    planterGroups[1]!.position.set(office.position.x + 2.2, 0, 2);
    base.scale.x = (count * L.bayWidth + 7.8) / 21.5;
    pavingJoints.scale.x = base.scale.x;
    pavingJoints.position.x = 1.3 * (1 - base.scale.x);
    reflection.scale.x = (count * L.bayWidth + 7.0) / 20.5;
    root.position.x = -1.2;
  }
  layout(3);
  return {
    root,
    bays,
    dividers,
    office,
    officeBack,
    frontGlass,
    sideGlass,
    node,
    nodeLed,
    updateMonitor,
    reflection,
    layout,
  };
}
