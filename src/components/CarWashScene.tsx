'use client';
import { useEffect, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  loadVehicleAsset,
  vehicleInstance,
  vehicleWheels,
  disposeVehicleAsset,
  updateVehiclePlate,
  vehicleFader,
} from './carwash/vehicle-asset';
import { buildCarWash } from './carwash/CarWashModel';
import { PALETTE as P } from './carwash/model-kit';
import {
  CARWASH_LAYOUT as L,
  carPose,
  sceneStage,
  type CarWashView,
} from '../lib/carwash-layout';
import { cameraEase } from '../lib/carwash-presentation';
import { carwashLoop, TOUR_SPEED, type CarWashTourKey } from '../lib/carwash-loop';
import type {
  CarWashHotspotId,
  CarWashPhase,
  CarWashSnapshot,
} from '../lib/carwash-simulation';

interface CarWashSceneProps {
  activeHotspot: CarWashHotspotId;
  focusBox: number;
  guidedCamera: boolean;
  onHotspotChange: (id: CarWashHotspotId) => void;
  onOverlayChange: (overlay: CarWashSceneOverlay | null) => void;
  onReady: () => void;
  phase: CarWashPhase;
  resetViewToken: number;
  tablet: { title: string; value: string; note: string };
  values: CarWashSnapshot;
  view?: CarWashView | null;
  eventTitle?: string;
  eventTone?: string;
  tourClock?: RefObject<number>;
  /** Какой сценарий играет тур; сцена читает тот же цикл, что и панель. */
  scenario?: CarWashTourKey;
}
export interface CarWashSceneOverlay {
  id: CarWashHotspotId;
  placement: 'above' | 'below';
  source: 'guided' | 'hover';
  x: number;
  y: number;
}
const HOTSPOT_VIEW: Record<CarWashHotspotId, CarWashView> = {
  node: 'hardware',
  camera: 'recognition',
  box: 'washing',
  entrance: 'arrival',
  tablet: 'order',
  washer: 'washing',
};
export default function CarWashScene(props: CarWashSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null),
    live = useRef(props),
    resetRef = useRef<(() => void) | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    live.current = props;
  }, [props]);
  useEffect(() => {
    resetRef.current?.();
  }, [props.resetViewToken]);
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch {
      setUnavailable(true);
      live.current.onReady();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.82;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    mount.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(P.backdrop);
    const camera = new THREE.PerspectiveCamera(36, 1, 0.08, 130);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 3;
    controls.maxDistance = 48;
    controls.maxPolarAngle = Math.PI * 0.485;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pmrem = new THREE.PMREMGenerator(renderer),
      room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, 0.025);
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.72;
    room.dispose();
    pmrem.dispose();
    scene.add(new THREE.HemisphereLight(P.white, P.graphite, 0.7));
    const key = new THREE.DirectionalLight(P.warm, 2.5);
    key.position.set(-9, 14, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -17;
    key.shadow.camera.right = 17;
    key.shadow.camera.top = 14;
    key.shadow.camera.bottom = -14;
    key.shadow.normalBias = 0.04;
    key.shadow.bias = -0.00015;
    key.shadow.radius = 4;
    scene.add(key);
    const fill = new THREE.DirectionalLight(P.white, 0.65);
    fill.position.set(4, 10, -5);
    scene.add(fill);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(180, 180),
      new THREE.ShadowMaterial({ color: P.graphite, opacity: 0.13 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.38;
    ground.receiveShadow = true;
    scene.add(ground);
    const model = buildCarWash();
    scene.add(model.root);
    const assetAbort = new AbortController();
    let assetReady = false;
    const vehicleInstances: THREE.Group[] = [];
    const wheelsByInstance: THREE.Object3D[][] = [];
    const fadeFallbacks = model.bays.map((bay) => vehicleFader(bay.car.group));
    const fadeVehicles: Array<(opacity: number) => void> = [];
    void loadVehicleAsset(assetAbort.signal)
      .then((template) => {
        if (assetAbort.signal.aborted) {
          disposeVehicleAsset(template);
          return;
        }
        template.visible = false;
        model.root.add(template);
        model.bays.forEach((bay, index) => {
          bay.car.group.children.forEach((child) => {
            if (child !== bay.scanner && child.name !== 'vehicle-contact-shadow')
              child.visible = false;
          });
          const instance = vehicleInstance(template, index === 0);
          vehicleInstances[index] = instance;
          wheelsByInstance[index] = vehicleWheels(instance);
          fadeVehicles[index] = vehicleFader(instance, false);
          bay.car.group.add(instance);
          // The hidden template is cloned only for resource sharing; instances render normally.
          bay.car.group.children.at(-1)!.visible = true;
        });
        assetReady = true;
      })
      .catch(() => {
        if (!assetAbort.signal.aborted) assetReady = true;
      });
    const destination = new THREE.Vector3(),
      target = new THREE.Vector3(),
      cameraFrom = new THREE.Vector3(),
      targetFrom = new THREE.Vector3(),
      world = new THREE.Vector3();
    let travelStarted = performance.now(),
      travelDuration = 3.2,
      travelLift = 0;
    const cutaways = [
      ...model.bays.map((bay) => bay.back),
      ...model.dividers.map((divider) => divider.wall),
    ];
    const cutawayMaterials = cutaways.map((group) => {
      const materials: THREE.Material[] = [];
      group.traverse((object) => {
        if (object instanceof THREE.Mesh && !Array.isArray(object.material)) {
          object.material = object.material.clone();
          object.material.transparent = true;
          materials.push(object.material);
        }
      });
      return { materials, opacity: 1, destination: 1 };
    });
    let view: CarWashView = 'overview',
      previousKey = '',
      moving = true,
      dragging = false;
    let frame = 0,
      previous = performance.now(),
      lastPaint = 0,
      stageStarted = previous,
      stageKey = '';
    let lastOverlay = '',
      hovered: CarWashHotspotId | null = null,
      reported = false;
    const raycaster = new THREE.Raycaster(),
      pointer = new THREE.Vector2(),
      startPointer = new THREE.Vector2();
    let down = false;
    function focus(next: CarWashView, immediate = false) {
      cameraFrom.copy(camera.position);
      targetFrom.copy(controls.target);
      travelStarted = performance.now();
      view = next;
      moving = true;
      const count = Math.round(live.current.values.boxes),
        i = Math.min(count - 1, Math.max(0, live.current.focusBox - 1));
      model.layout(count);
      scene.updateMatrixWorld(true);
      const x = model.bays[i]!.group.getWorldPosition(world).x,
        officeX = model.office.getWorldPosition(new THREE.Vector3()).x;
      const wide = camera.aspect < 1 ? 1.5 : 1,
        aspectScale = Math.max(1, 1.7 / camera.aspect);
      switch (next) {
        case 'recognition':
          destination.set(x - 1.85 * wide, 2.35, L.backZ - 2.15 * wide);
          target.set(x + 0.15, 1.1, -2.95);
          break;
        case 'order':
          destination.set(officeX + 0.05 * wide, 1.65, 0.65 * wide);
          target.set(officeX - 0.1, 1.2, -1.32);
          break;
        case 'hardware':
          destination.set(officeX + 1.55 * wide, 1.8, 0.6 * wide);
          target.set(officeX + 0.45, 1, -1.35);
          break;
        case 'washing':
          destination.set(x - 3.8 * wide, 2.5, 2.8 * wide);
          target.set(x - 0.65, 1, -0.7);
          break;
        case 'arrival':
          destination.set(x - 8.8 * wide, 6.1, 15 * wide);
          target.set(x, 0.85, 2);
          break;
        case 'departure':
          destination.set(x - 10.6 * wide, 7.4, 18 * wide);
          target.set(x + 1, 0.8, 3);
          break;
        default:
          destination.set(-7.6 * aspectScale, 8.4 * aspectScale, 20.4 * aspectScale);
          target.set(1, 0.9, 0.4);
          break;
      }
      const distance = cameraFrom.distanceTo(destination);
      travelDuration = Math.min(4.2, Math.max(2.6, distance * 0.12)) / TOUR_SPEED;
      travelLift = distance > 7 ? Math.max(0, 5.2 - Math.min(cameraFrom.y, destination.y)) : 0;
      cutawayMaterials.forEach((wall, index) => {
        wall.destination =
          index < model.bays.length
            ? next === 'recognition' && index === i
              ? 0
              : 1
            : next === 'washing' && index - model.bays.length === i
              ? 0
              : 1;
      });
      model.dividers.forEach((d, index) => {
        d.group.visible = index <= count;
      });
      model.officeBack.visible = next !== 'hardware';
      if (immediate || reducedMotion) {
        camera.position.copy(destination);
        controls.target.copy(target);
        controls.update();
        moving = false;
      }
    }
    resetRef.current = () => {
      focus('overview');
    };
    const resize = () => {
      const { width, height } = mount.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      focus(view, !reported);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();
    focus('overview', true);
    const pick = (event: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - r.left) / r.width) * 2 - 1,
        (-(event.clientY - r.top) / r.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      hovered = null;
      const hit = raycaster.intersectObject(model.root, true).find((h) => {
        let o: THREE.Object3D | null = h.object;
        while (o) {
          if (!o.visible) return false;
          o = o.parent;
        }
        return h.object !== model.reflection;
      });
      let object = hit?.object ?? null;
      while (object) {
        if (object.userData.hotspot) {
          hovered = object.userData.hotspot;
          break;
        }
        object = object.parent;
      }
      renderer.domElement.style.cursor = hovered ? 'pointer' : 'grab';
    };
    const pointerDown = (e: PointerEvent) => {
      down = true;
      startPointer.set(e.clientX, e.clientY);
    };
    const pointerUp = (e: PointerEvent) => {
      if (
        down &&
        startPointer.distanceTo(new THREE.Vector2(e.clientX, e.clientY)) < 5 &&
        hovered
      ) {
        live.current.onHotspotChange(hovered);
        focus(HOTSPOT_VIEW[hovered]);
      }
      down = false;
    };
    const interrupt = () => {
        moving = false;
        dragging = true;
      },
      resume = () => {
        dragging = false;
      },
      leave = () => {
        hovered = null;
        down = false;
      };
    renderer.domElement.addEventListener('pointermove', pick);
    renderer.domElement.addEventListener('pointerdown', pointerDown);
    renderer.domElement.addEventListener('pointerup', pointerUp);
    renderer.domElement.addEventListener('pointerleave', leave);
    controls.addEventListener('start', interrupt);
    controls.addEventListener('end', resume);
    const contextLost = (e: Event) => {
        e.preventDefault();
        setUnavailable(true);
      },
      restored = () => setUnavailable(false);
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    renderer.domElement.addEventListener('webglcontextrestored', restored);
    function animate(now: number) {
      frame = requestAnimationFrame(animate);
      if (document.hidden) return;
      if (now - lastPaint < 1000 / 40) return;
      lastPaint = now;
      const delta = Math.min(0.25, (now - previous) / 1000);
      previous = now;
      const p = live.current,
        count = Math.round(p.values.boxes);
      const tour = p.tourClock ? carwashLoop(p.tourClock.current, p.scenario) : null;
      model.layout(count);
      const focusIndex = Math.min(count - 1, Math.max(0, p.focusBox - 1)),
        stage = p.view ?? sceneStage(p.phase, p.activeHotspot);
      const newStageKey = `${stage}:${p.focusBox}`;
      if (stageKey !== newStageKey) {
        stageKey = newStageKey;
        stageStarted = now;
      }
      const currentStageTime = (now - stageStarted) / 1000;
      model.updateMonitor(
        p.tablet.value,
        p.eventTitle ??
          {
            overview: 'LIVE MONITORING',
            arrival: 'VEHICLE DETECTED',
            recognition: 'PLATE RECOGNIZED',
            order: 'ORDER ACCEPTED',
            washing: 'WASH IN PROGRESS',
            departure: 'VISIT COMPLETED',
            hardware: 'EDGE PROCESSING',
          }[stage],
        p.focusBox,
        p.eventTone,
        // Пока визит помечен треугольником, номер остаётся в строке монитора даже
        // после выезда машины: запись в системе живёт дольше, чем бокс занят.
        tour?.cars.map((car) =>
          car.alert !== 'none' || (car.opacity > 0 && car.z < L.frontZ) ? car.plate : null,
        ),
        tour?.cars.map((car) => car.alert),
        tour?.service
          ? {
              label: tour.service.performedShort,
              minutes: tour.service.performedMinutes,
              price: tour.service.performedPrice,
            }
          : null,
      );
      const requested = p.view ?? (p.guidedCamera ? stage : 'overview'),
        key = `${requested}:${p.focusBox}:${count}`;
      if (previousKey !== key) {
        previousKey = key;
        focus(requested);
      }
      if (moving && !dragging) {
        const amount = cameraEase((now - travelStarted) / 1000 / travelDuration);
        controls.enableDamping = false;
        camera.position.lerpVectors(cameraFrom, destination, amount);
        camera.position.y += Math.sin(Math.PI * amount) ** 2 * travelLift;
        controls.target.lerpVectors(targetFrom, target, amount);
        if (amount === 1) moving = false;
      }
      controls.enableDamping = !moving;
      for (const [index, wall] of cutawayMaterials.entries()) {
        // Restore the rear wall only after the travelling camera has cleared it.
        const opacityTarget =
          index === focusIndex && camera.position.z < L.backZ + 0.25 && camera.position.y < 4.3
            ? 0
            : wall.destination;
        wall.opacity = reducedMotion
          ? opacityTarget
          : THREE.MathUtils.damp(wall.opacity, opacityTarget, 3, delta);
        for (const material of wall.materials) {
          material.opacity = wall.opacity;
          material.depthWrite = wall.opacity > 0.98;
          material.visible = wall.opacity > 0.015;
        }
      }
      const preview =
        (p.phase === 'stable' || p.phase === 'adjusting') &&
        (!p.view || p.view === 'overview' || p.view === 'hardware');
      for (const [i, bay] of model.bays.entries()) {
        if (i >= count) continue;
        const hero = i === focusIndex,
          background = i === 0 && !hero;
        const traffic = tour?.cars[i];
        const plate = traffic?.plate ?? (hero ? p.tablet.value : '');
        if (vehicleInstances[i] && /\d{3}\s[A-Z]{3}\s\d{2}/.test(plate)) {
          const instance = vehicleInstances[i]!;
          if (instance.userData.plate !== plate) {
            updateVehiclePlate(instance, plate);
            instance.userData.plate = plate;
          }
        }
        bay.car.group.visible = traffic ? traffic.opacity > 0 : hero || background;
        const pose = traffic
            ? {
                z: reducedMotion
                  ? traffic.motion === 'departure' && traffic.opacity < 1
                    ? L.exitZ
                    : L.parkZ
                  : traffic.z,
                rotationY: Math.PI,
              }
            : carPose(
                hero && !preview ? stage : 'overview',
                reducedMotion ? 1 : currentStageTime / 4.5,
              ),
          oldZ = bay.car.group.position.z;
        bay.car.group.position.z = pose.z;
        bay.car.group.rotation.y = traffic || hero ? pose.rotationY : 0;
        fadeFallbacks[i]?.(traffic?.opacity ?? 1);
        fadeVehicles[i]?.(traffic?.opacity ?? 1);
        // Sign follows travel: the wheel rolls backwards for the axle, not with it.
        bay.car.wheels.forEach((wheel) => {
          wheel.rotation.x -= (pose.z - oldZ) / 0.37;
        });
        for (const wheel of wheelsByInstance[i] ?? []) {
          wheel.rotation.x -= (pose.z - oldZ) / 0.37;
        }
        const reading =
          traffic?.reading ??
          (hero && (stage === 'recognition' || stage === 'departure') && !preview);
        bay.scanner.visible = reading || (hero && view === 'recognition');
        bay.zoneMat.opacity = reading ? 0.085 : 0;
        bay.cameraGlow.visible = bay.cameraHalo.visible = bay.scanner.visible;
        bay.cameraGlowMat.opacity = reducedMotion ? 0.85 : 0.65 + Math.sin(now * 0.004) * 0.25;
        bay.cameraHalo.scale.setScalar(reducedMotion ? 1 : 1 + ((now * 0.00065) % 1) * 0.45);
        bay.scanLine.position.y = reducedMotion ? 0 : Math.sin(now * 0.003) * 0.085;
        bay.scanner.scale.setScalar(reducedMotion ? 1 : 1 + Math.sin(now * 0.003) * 0.025);
        const washing = traffic?.washing ?? (hero && stage === 'washing' && !preview);
        bay.worker.visible = traffic ? washing : hero || background;
        bay.worker.position.z =
          L.parkZ +
          (washing && !reducedMotion ? Math.sin(now * 0.00065 * TOUR_SPEED) * 0.45 : 0.4);
        bay.workerUpper.rotation.y =
          washing && !reducedMotion ? Math.sin(now * 0.001) * 0.075 : 0;
        bay.workerUpper.rotation.z = washing ? -0.045 : 0;
        bay.spray.visible = washing;
        if (washing) {
          for (let j = 0; j < 90; j++) {
            const t = reducedMotion ? j / 90 : (j / 90 + now * 0.002) % 1;
            bay.particlePositions[j * 3] = 0.63 + t * 0.6;
            bay.particlePositions[j * 3 + 1] =
              0.07 - t * 0.12 - t * t * 0.36 + Math.sin(j * 7) * t * 0.1;
            bay.particlePositions[j * 3 + 2] = 0.06 + Math.sin(j * 13) * t * 0.18;
          }
          bay.spray.geometry.attributes.position!.needsUpdate = true;
        }
        const c =
          hero && p.phase === 'requires-attention'
            ? P.red
            : bay.car.group.visible
              ? P.blue
              : P.green;
        bay.lampMat.color.set(c);
        bay.lampMat.emissive.set(c);
        if (traffic) {
          bay.car.group.userData.motion = traffic.motion;
        }
      }
      controls.update();
      scene.updateMatrixWorld(true);
      const id =
        hovered ?? (view === 'recognition' ? 'camera' : view === 'hardware' ? 'node' : null);
      if (id && !dragging) {
        const object =
          id === 'node'
            ? model.node
            : id === 'tablet'
              ? model.office
              : model.bays[focusIndex]!.camera;
        object.getWorldPosition(world);
        world.y += 0.28;
        world.project(camera);
        const x = (world.x * 0.5 + 0.5) * 100,
          y = (-world.y * 0.5 + 0.5) * 100;
        const signature = `${id}:${Math.round(x)}:${Math.round(y)}`;
        if (signature !== lastOverlay) {
          lastOverlay = signature;
          live.current.onOverlayChange(
            world.z < 1 && x > 3 && x < 93 && y > 12 && y < 88
              ? {
                  id,
                  x,
                  y,
                  placement: 'above',
                  source: hovered ? 'hover' : 'guided',
                }
              : null,
          );
        }
      } else if (lastOverlay) {
        lastOverlay = '';
        live.current.onOverlayChange(null);
      }
      if (mount) {
        mount.dataset.view = view;
        mount.dataset.stage = stage;
        mount.dataset.cameraMoving = String(moving);
        if (tour) {
          mount.dataset.focusBox = String(tour.focusBox);
          mount.dataset.tourVisit = String(tour.visit);
          mount.dataset.traffic = tour.cars.map((car) => car.motion).join(',');
        }
      }
      renderer.render(scene, camera);
      if (!reported && assetReady) {
        reported = true;
        live.current.onReady();
      }
    }
    frame = requestAnimationFrame(animate);
    return () => {
      assetAbort.abort();
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      resetRef.current = null;
      controls.removeEventListener('start', interrupt);
      controls.removeEventListener('end', resume);
      controls.dispose();
      renderer.domElement.removeEventListener('pointermove', pick);
      renderer.domElement.removeEventListener('pointerdown', pointerDown);
      renderer.domElement.removeEventListener('pointerup', pointerUp);
      renderer.domElement.removeEventListener('pointerleave', leave);
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', restored);
      model.reflection.getRenderTarget().dispose();
      environment.dispose();
      live.current.onOverlayChange(null);
      const geometries = new Set<THREE.BufferGeometry>(),
        materials = new Set<THREE.Material>(),
        textures = new Set<THREE.Texture>();
      scene.traverse((object) => {
        if (
          object instanceof THREE.Mesh ||
          object instanceof THREE.Points ||
          object instanceof THREE.Line
        ) {
          geometries.add(object.geometry);
          (Array.isArray(object.material) ? object.material : [object.material]).forEach((m) =>
            materials.add(m),
          );
        }
      });
      materials.forEach((m) => {
        for (const value of Object.values(m))
          if (value instanceof THREE.Texture) textures.add(value);
        m.dispose();
      });
      geometries.forEach((g) => g.dispose());
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  return (
    <div
      ref={mountRef}
      className="farm-scene-canvas carwash-canvas"
      aria-label="Интерактивная 3D-модель автомойки"
    >
      {unavailable ? (
        <div className="farm-scene-loading" role="status">
          3D недоступно в этом браузере. Этапы визита и события доступны в интерфейсе.
        </div>
      ) : null}
    </div>
  );
}
