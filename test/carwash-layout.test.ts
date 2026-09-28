import { describe, expect, it } from 'vitest';
import { CARWASH_LAYOUT as L, bayCenter, carPose, sceneStage } from '../src/lib/carwash-layout';

describe('continuous physical car-wash layout', () => {
  it('parks the complete car inside a closed bay with clearance', () => {
    expect(L.parkZ - L.carLength / 2).toBeGreaterThan(L.backZ + 0.6);
    expect(L.parkZ + L.carLength / 2).toBeLessThan(L.frontZ - 0.3);
    expect(L.bayWidth).toBeGreaterThan(L.carWidth + 1.3);
  });
  it.each([2, 3, 4])('keeps %i bays spaced and centers the row', (count) => {
    expect(bayCenter(0, count) + bayCenter(count - 1, count)).toBe(0);
    expect(bayCenter(1, count) - bayCenter(0, count)).toBe(L.bayWidth);
  });
  it('enters nose first, stands for recognition/order/wash and reverses out without rotating', () => {
    const enter = [0, 0.25, 0.5, 0.75, 1].map((t) => carPose('arrival', t));
    expect(enter.every((p, i) => i === 0 || p.z <= enter[i - 1]!.z)).toBe(true);
    expect(enter.at(-1)!.z).toBeCloseTo(L.parkZ);
    for (const stage of ['recognition', 'order', 'washing'] as const) {
      expect(carPose(stage, 0).z).toBe(L.parkZ);
      expect(carPose(stage, 1).z).toBe(L.parkZ);
    }
    const exit = [0, 0.25, 0.5, 0.75, 1].map((t) => carPose('departure', t));
    expect(exit.every((p, i) => i === 0 || p.z >= exit[i - 1]!.z)).toBe(true);
    expect(exit[0]!.z).toBe(L.parkZ);
    expect(exit.at(-1)!.z - L.carLength / 2).toBeGreaterThan(L.frontZ);
    expect([...enter, ...exit].every((p) => p.rotationY === Math.PI)).toBe(true);
  });
  it('maps order confirmation and washing to distinct shots even within one phase', () => {
    expect(sceneStage('correcting', 'tablet')).toBe('order');
    expect(sceneStage('correcting', 'washer')).toBe('washing');
    expect(sceneStage('verifying', 'box')).toBe('departure');
  });
});
