import { describe, expect, it } from 'vitest';
import { CARWASH_LAYOUT as L } from '../src/lib/carwash-layout';
import { carwashLoop, TOUR_SPEED, VISIT_SECONDS } from '../src/lib/carwash-loop';

describe('continuous carwash tour', () => {
  it('starts with box 1 leaving, box 3 occupied and box 2 arriving', () => {
    const frame = carwashLoop(0);
    expect(frame.focusBox).toBe(2);
    expect(frame.cars.map((car) => car.motion)).toEqual(['departure', 'arrival', 'parked']);
  });
  it('runs 50% faster and follows box 2, 1, 3 indefinitely', () => {
    expect(TOUR_SPEED).toBe(1.5);
    expect(VISIT_SECONDS).toBeCloseTo(36.5 / 1.5);
    expect(
      Array.from({ length: 9 }, (_, n) => carwashLoop(n * VISIT_SECONDS + 0.01).focusBox),
    ).toEqual([2, 1, 3, 2, 1, 3, 2, 1, 3]);
  });
  it('shows recognition, node, order and washing before departure', () => {
    expect([1, 8, 15, 18, 24, 31].map((base) => carwashLoop(base / TOUR_SPEED).view)).toEqual([
      'arrival',
      'recognition',
      'hardware',
      'order',
      'washing',
      'departure',
    ]);
  });
  it('fades out only beyond the bay and respawns while invisible', () => {
    for (let t = 0; t < VISIT_SECONDS * 7; t += 0.037) {
      const a = carwashLoop(t),
        b = carwashLoop(t + 0.001);
      a.cars.forEach((car, i) => {
        if (car.motion === 'departure' && car.opacity < 0.99) {
          expect(car.z - L.carLength / 2).toBeGreaterThan(L.frontZ);
        }
        if (car.opacity > 0.01 && b.cars[i]!.opacity > 0.01) {
          expect(Math.abs(car.z - b.cars[i]!.z)).toBeLessThan(0.02);
          expect(car.plate).toBe(b.cars[i]!.plate);
        }
      });
    }
  });
  it('replaces vehicles and keeps background traffic independent of the hero shot', () => {
    const frame = carwashLoop(10 / TOUR_SPEED);
    expect(frame.view).toBe('recognition');
    const later = carwashLoop((VISIT_SECONDS * TOUR_SPEED + 10) / TOUR_SPEED);
    expect(later.cars[1]!.motion).toBe('arrival');
    expect(carwashLoop(VISIT_SECONDS * 3 + 0.1).cars[1]!.plate).not.toBe(
      carwashLoop(0.1).cars[1]!.plate,
    );
  });
});
