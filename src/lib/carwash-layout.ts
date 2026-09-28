import type { CarWashHotspotId, CarWashPhase } from './carwash-simulation';

/** Metres. One coherent, closed-back building shared by every camera shot. */
export const CARWASH_LAYOUT = {
  bayWidth: 4.1,
  backZ: -4.2,
  frontZ: 3.5,
  height: 3.6,
  parkZ: -0.65,
  arrivalZ: 7,
  exitZ: 7,
  carLength: 4.85,
  carWidth: 1.84,
  cameraY: 2.2,
} as const;

export type CarWashView =
  'overview' | 'arrival' | 'recognition' | 'order' | 'washing' | 'departure' | 'hardware';
export const bayCenter = (index: number, count: number) =>
  (index - (count - 1) / 2) * CARWASH_LAYOUT.bayWidth;
export function sceneStage(phase: CarWashPhase, hotspot: CarWashHotspotId): CarWashView {
  if (phase === 'stable' || phase === 'adjusting') return 'overview';
  if (phase === 'recovered' || phase === 'requires-attention') return 'departure';
  if (phase === 'verifying') return 'departure';
  if (hotspot === 'node') return 'hardware';
  if (hotspot === 'tablet') return 'order';
  if (hotspot === 'washer') return 'washing';
  if (phase === 'detecting') return 'arrival';
  if (phase === 'evaluating') return 'recognition';
  return 'washing';
}
export function carPose(stage: CarWashView, progress: number) {
  const t = Math.min(1, Math.max(0, progress));
  const ease = t * t * (3 - 2 * t);
  const { parkZ, arrivalZ, exitZ } = CARWASH_LAYOUT;
  const z =
    stage === 'arrival'
      ? arrivalZ + (parkZ - arrivalZ) * ease
      : stage === 'departure'
        ? parkZ + (exitZ - parkZ) * ease
        : parkZ;
  return { z, rotationY: Math.PI };
}
