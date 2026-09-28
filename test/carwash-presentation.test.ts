import { describe, expect, it } from 'vitest';
import { carwashEvent, cameraEase } from '../src/lib/carwash-presentation';

describe('carwash presentation', () => {
  it('tells the complete visit in compact events, retaining the plate at departure', () => {
    const events = Array.from({ length: 6 }, (_, step) =>
      carwashEvent('normal-visit', step, 2, '559 BJV 05'),
    );
    expect(events.map((event) => event.title)).toEqual([
      'Машина замечена',
      'Номер распознан',
      'Заказ принят',
      'Мойка в работе',
      'Заказ выполнен',
      'Выезд зафиксирован',
    ]);
    expect(events[5]?.detail).toBe('Бокс 2 · 559 BJV 05');
  });
  it('never marks missing orders or offline buffering with a success check', () => {
    expect(carwashEvent('no-order', 2, 3).tone).toBe('warning');
    expect(carwashEvent('no-order', 4, 3).tone).toBe('warning');
    expect(carwashEvent('node-offline', 2, 2).tone).toBe('info');
    expect(carwashEvent('node-offline', 3, 2).title).toBe('Связь восстановлена');
  });
  it('eases camera acceleration and braking with exact stable endpoints', () => {
    expect(cameraEase(-1)).toBe(0);
    expect(cameraEase(2)).toBe(1);
    expect(cameraEase(0.5)).toBeCloseTo(0.5);
    expect(cameraEase(0.01)).toBeLessThan(0.00002);
    expect(1 - cameraEase(0.99)).toBeLessThan(0.00002);
    const values = Array.from({ length: 101 }, (_, i) => cameraEase(i / 100));
    expect(values.every((value, i) => i === 0 || value >= values[i - 1]!)).toBe(true);
  });
});
