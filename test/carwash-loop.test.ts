import { describe, expect, it } from 'vitest';
import { CARWASH_LAYOUT as L } from '../src/lib/carwash-layout';
import { carwashLoop, carwashTourSeconds, TOUR_SPEED, VISIT_SECONDS } from '../src/lib/carwash-loop';

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

describe('сценарий «машина не из списка»', () => {
  const unknown = (wall: number) => carwashLoop(wall, 'unknown-car');
  it('начинается ровно как обычный визит и расходится только на сверке номера', () => {
    expect([0, 5].map((wall) => unknown(wall).title)).toEqual([0, 5].map((wall) => carwashLoop(wall).title));
    expect(unknown(12).title).toBe('В системе такого номера нет');
    expect(carwashLoop(12).title).toBe('Заказ взят в работу');
  });
  it('добавляет визит в журнал с жёлтым треугольником и красным при неоплате', () => {
    const alerts = [0, 10, 16, 22, 30, 33, 36, 40].map((wall) => unknown(wall).alert);
    expect(alerts).toEqual(['none', 'none', 'review', 'review', 'review', 'review', 'unpaid', 'unpaid']);
  });
  it('держит номер в записи после выезда, пока висит флаг', () => {
    const frame = unknown(36);
    const car = frame.cars[frame.focusBox - 1]!;
    expect(car.motion).toBe('departure');
    expect(car.z).toBeGreaterThan(L.frontZ);
    expect(car.alert).toBe('unpaid');
    expect(car.plate).toMatch(/\d{3} [A-Z]{3} \d{2}/);
  });
  it('показывает пуш собственнику на неоплате и зацикливает визит', () => {
    expect(unknown(38).notice).toBe('unpaid');
    expect(unknown(38).tone).toBe('warning');
    const next = carwashLoop(carwashTourSeconds('unknown-car'), 'unknown-car');
    expect(next.visit).toBe(1);
    expect(next.alert).toBe('none');
    expect(next.notice).toBe('none');
  });
  it('не трогает обычный визит: у него нет ни флага, ни пуша', () => {
    expect(carwashLoop(0).alert).toBe('none');
    expect(carwashLoop(30).alert).toBe('none');
    expect(carwashLoop(30).notice).toBe('none');
  });
});

describe('сценарий «оказана другая услуга»', () => {
  const other = (wall: number) => carwashLoop(wall, 'other-service');
  it('начинается так же, как остальные визиты, и до выбора услуги ничем не отличается', () => {
    expect(other(0).title).toBe('Машина заезжает');
    expect(other(8).title).toBe('Номер распознан');
    expect(other(12).title).toBe('Запись найдена, всё в порядке');
  });
  it('несёт заказ и факт: услуга, время в боксе и суммы', () => {
    expect(other(19).service).toEqual({
      ordered: 'Комплексная мойка',
      performed: 'Мойка кузова',
      performedShort: 'BODY WASH',
      orderedMinutes: 60,
      performedMinutes: 20,
      orderedPrice: 4900,
      performedPrice: 1900,
    });
    expect(carwashLoop(19).service).toBeNull();
  });
  it('сотруднику не показывает ошибку: ни треугольника, ни пуша за весь визит', () => {
    const alerts = [0, 8, 15, 20, 24, 30, 34, 40].map((wall) => other(wall).alert);
    expect(alerts).toEqual(Array<string>(8).fill('none'));
    expect([0, 20, 30, 36].every((wall) => other(wall).notice === 'none')).toBe(true);
  });
  it('отправляет сигнал службе контроля только на последнем шаге', () => {
    expect([0, 20, 30, 33].map((wall) => other(wall).staffAlert)).toEqual([
      'none',
      'none',
      'none',
      'none',
    ]);
    expect(other(36).staffAlert).toBe('service-mismatch');
    expect(other(36).title).toBe('Сигнал в службу контроля');
  });
  it('зацикливается и сбрасывает сигнал вместе с визитом', () => {
    const next = carwashLoop(carwashTourSeconds('other-service'), 'other-service');
    expect(next.visit).toBe(1);
    expect(next.staffAlert).toBe('none');
    expect(next.alert).toBe('none');
  });
});

describe('сценарий «машина простаивает в боксе»', () => {
  const idle = (wall: number) => carwashLoop(wall, 'idle-box');
  it('начинается как обычный визит: заезд, номер, заказ с исполнителем', () => {
    expect(idle(0).title).toBe('Машина заезжает');
    expect(idle(8).title).toBe('Номер распознан');
    expect(idle(12).title).toBe('Заказ взят в работу');
  });
  it('держит машину в боксе двадцать минут: работа не идёт, камера считает простой', () => {
    const idleShot = idle(20);
    expect(idleShot.title).toBe('В боксе двадцать минут никого');
    expect(idleShot.idleNote).toBe(20);
    expect(idleShot.cars[idleShot.focusBox - 1]!.washing).toBe(false);
    expect(idleShot.cars[idleShot.focusBox - 1]!.motion).toBe('parked');
    // Простой тянется дольше любого шага обычного визита: 21 базовая секунда.
    expect(idle(27).title).toBe('В боксе двадцать минут никого');
  });
  it('считает простой и саму услугу: 20 минут без сотрудника, потом 10 минут работы', () => {
    expect(idle(30).idle).toEqual({ minutes: 20, washMinutes: 10 });
    expect(idle(30).title).toBe('Сотрудник подошёл');
    expect(idle(35).title).toBe('Мойка в работе');
    expect(idle(35).cars[idle(35).focusBox - 1]!.washing).toBe(true);
    expect(carwashLoop(30).idle).toBeNull();
  });
  it('записи визита не касается: ни треугольника, ни простоя на мониторе после мойки', () => {
    expect([0, 12, 20, 27, 30, 35, 40].map((wall) => idle(wall).alert)).toEqual(
      Array<string>(7).fill('none'),
    );
    expect(idle(35).idleNote).toBeNull();
    expect([0, 20, 30, 40].map((wall) => idle(wall).staffAlert)).toEqual(
      Array<string>(4).fill('none'),
    );
  });
  it('пишет собственнику только на последнем шаге визита', () => {
    expect([0, 20, 30, 40].map((wall) => idle(wall).notice)).toEqual([
      'none',
      'none',
      'none',
      'none',
    ]);
    expect(idle(45).notice).toBe('idle');
    expect(idle(45).title).toBe('Проверьте, где был сотрудник');
  });
  it('зацикливается и сбрасывает простой вместе с визитом', () => {
    expect(carwashTourSeconds('idle-box')).toBeCloseTo(72 / TOUR_SPEED);
    const next = carwashLoop(carwashTourSeconds('idle-box'), 'idle-box');
    expect(next.visit).toBe(1);
    expect(next.notice).toBe('none');
    expect(next.idleNote).toBeNull();
  });
});
