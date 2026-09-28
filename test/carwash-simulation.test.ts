import { describe, expect, it } from 'vitest';

import {
  CARWASH_BASELINE,
  CARWASH_RANGES,
  carwashAdjustmentPlan,
  carwashApplyBoard,
  carwashIdleBoard,
  carwashScenarioPlan,
  carwashZone,
  type CarWashMetricKey,
  type CarWashScenarioKey,
} from '../src/lib/carwash-simulation.js';

const SCENARIOS: CarWashScenarioKey[] = ['normal-visit', 'no-order', 'time-mismatch', 'node-offline', 'back-to-back'];
const METRICS: CarWashMetricKey[] = ['boxes', 'flow', 'noOrderMin'];

describe('диапазоны и зоны автомойки', () => {
  it('держит зафиксированные диапазоны параметров', () => {
    expect(CARWASH_RANGES.boxes).toEqual({ min: 2, max: 4, step: 1, warningLow: 2, safeLow: 2, safeHigh: 4, warningHigh: 4 });
    expect(CARWASH_RANGES.flow).toEqual({ min: 2, max: 24, step: 1, warningLow: 4, safeLow: 6, safeHigh: 14, warningHigh: 18 });
    expect(CARWASH_RANGES.noOrderMin).toEqual({ min: 3, max: 30, step: 1, warningLow: 5, safeLow: 7, safeHigh: 15, warningHigh: 20 });
  });

  it('стартует из зелёной зоны, а порог «без заказа» повторяет дефолт спека', () => {
    expect(CARWASH_BASELINE).toEqual({ boxes: 3, flow: 9, noOrderMin: 10 });
    for (const key of METRICS) expect(carwashZone(key, CARWASH_BASELINE[key])).toBe('normal');
  });

  it('число боксов остаётся зелёным на всём ходу ползунка: это структура, а не коридор', () => {
    for (const boxes of [2, 3, 4]) expect(carwashZone('boxes', boxes)).toBe('normal');
  });

  it.each([
    ['flow', 6, 'normal'],
    ['flow', 14, 'normal'],
    ['flow', 5, 'warning'],
    ['flow', 3, 'critical'],
    ['flow', 20, 'critical'],
    ['noOrderMin', 7, 'normal'],
    ['noOrderMin', 6, 'warning'],
    ['noOrderMin', 4, 'critical'],
    ['noOrderMin', 24, 'critical'],
  ] as const)('относит %s=%s к зоне %s', (key, value, zone) => {
    expect(carwashZone(key, value)).toBe(zone);
  });
});

describe('доска боксов', () => {
  it('пустая доска строится по числу боксов', () => {
    const board = carwashIdleBoard(3);

    expect(board.map((card) => card.box)).toEqual([1, 2, 3]);
    expect(board.every((card) => card.status === 'free' && card.plate === null && card.seconds === null)).toBe(true);
  });

  it('патч шага меняет только названные плитки', () => {
    const next = carwashApplyBoard(carwashIdleBoard(3), [{ box: 2, status: 'busy', plate: '559 BJV 05' }]);

    expect(next[1]).toMatchObject({ box: 2, status: 'busy', plate: '559 BJV 05' });
    expect(next[0]?.status).toBe('free');
    expect(next[2]?.status).toBe('free');
  });

  it('патч на бокс вне текущего числа боксов не ломает доску', () => {
    const next = carwashApplyBoard(carwashIdleBoard(2), [{ box: 4, status: 'violation' }]);

    expect(next).toHaveLength(2);
    expect(next.every((card) => card.status === 'free')).toBe(true);
  });
});

describe('сценарии автомойки', () => {
  it.each(SCENARIOS)('%s проходит полный цикл реакции', (key) => {
    const plan = carwashScenarioPlan(key);
    const last = plan.requiresAttention ? 'requires-attention' : 'recovered';

    expect(plan.steps.map((step) => step.phase)).toEqual(key === 'normal-visit' ? ['detecting', 'evaluating', 'correcting', 'correcting', 'verifying', last] : ['detecting', 'evaluating', 'correcting', 'verifying', last]);
    expect(plan.steps.filter((step) => step.duration > 0).every((step) => step.duration >= 7_000)).toBe(true);
    expect(plan.label.length).toBeGreaterThan(0);
    expect(plan.focusBox).toBeGreaterThanOrEqual(1);
    expect(plan.focusBox).toBeLessThanOrEqual(4);
  });

  it('обычный визит доводит плитку от заезда до заказа и обратно в свободные', () => {
    const plan = carwashScenarioPlan('normal-visit');
    const [detect, read, order, washing, departure, done] = plan.steps;
    expect(washing?.hotspot).toBe('washer');
    expect(departure?.phase).toBe('verifying');

    expect(detect?.board?.[0]).toMatchObject({ box: plan.focusBox, status: 'busy', seconds: 0 });
    // Номер приходит с камеры именно на втором шаге — это и есть точка контроля.
    expect(read?.hotspot).toBe('camera');
    expect(read?.board?.[0]?.plate).toMatch(/\d{3} [A-Z]{3} \d{2}/);
    expect(read?.board?.[0]?.make).toBeTruthy();
    expect(order?.board?.[0]?.status).toBe('ordered');
    expect(order?.notification).toMatch(/заказ оформлен/i);
    expect(done?.board?.[0]?.status).toBe('free');
    expect(plan.requiresAttention).toBe(false);
  });

  it('машина без заказа поднимает нарушение и оставляет работу человеку', () => {
    const plan = carwashScenarioPlan('no-order');
    const correcting = plan.steps.find((step) => step.phase === 'correcting');
    const verifying = plan.steps.find((step) => step.phase === 'verifying');

    expect(correcting?.board?.[0]?.status).toBe('violation');
    expect(correcting?.notification).toMatch(/без заказа/i);
    expect(verifying?.violations).toBe(1);
    expect(plan.requiresAttention).toBe(true);
    expect(plan.steps.at(-1)?.phase).toBe('requires-attention');
  });

  it('расхождение по времени закрывается разбором, а не аварией', () => {
    const plan = carwashScenarioPlan('time-mismatch');
    const correcting = plan.steps.find((step) => step.phase === 'correcting');

    expect(correcting?.board?.[0]?.status).toBe('violation');
    expect(correcting?.violations).toBe(1);
    expect(plan.requiresAttention).toBe(false);
    expect(plan.steps.at(-1)?.message).toMatch(/порог/i);
  });

  it('офлайн-нода гасит все плитки и догоняет сервер из буфера', () => {
    const plan = carwashScenarioPlan('node-offline');
    const [detect, , buffering, recovery] = plan.steps;

    expect(detect?.board?.every((patch) => patch.status === 'offline')).toBe(true);
    expect(buffering?.notification).toMatch(/буфер/i);
    expect(recovery?.board?.some((patch) => patch.note?.includes('буфер'))).toBe(true);
    // Нарушений за период офлайна не поднимается (спек §6).
    expect(plan.steps.every((step) => step.violations === undefined)).toBe(true);
  });

  it('две машины подряд не склеиваются, если номер другой', () => {
    const plan = carwashScenarioPlan('back-to-back');
    const evaluating = plan.steps.find((step) => step.phase === 'evaluating');
    const correcting = plan.steps.find((step) => step.phase === 'correcting');

    expect(evaluating?.board?.[0]?.plate).toBeTruthy();
    expect(correcting?.message).toMatch(/склейка не применяется/i);
    expect(correcting?.notification).toMatch(/склейка/i);
  });
});

describe('ручная коррекция параметров', () => {
  it('в зелёной зоне коррекции нет', () => {
    for (const key of METRICS) expect(carwashAdjustmentPlan(CARWASH_BASELINE, key, CARWASH_BASELINE[key])).toBeNull();
  });

  it('число боксов не порождает коррекцию: ползунок перестраивает сцену', () => {
    expect(carwashAdjustmentPlan(CARWASH_BASELINE, 'boxes', 4)).toBeNull();
    expect(carwashAdjustmentPlan(CARWASH_BASELINE, 'boxes', 2)).toBeNull();
  });

  it.each([
    ['flow', 22],
    ['flow', 3],
    ['noOrderMin', 28],
    ['noOrderMin', 4],
  ] as const)('выводит %s=%s обратно в зелёную зону тем же пятишаговым циклом', (key, value) => {
    const plan = carwashAdjustmentPlan(CARWASH_BASELINE, key, value)!;

    expect(plan).toBeTruthy();
    expect(plan.steps.map((step) => step.phase)).toEqual(['detecting', 'evaluating', 'correcting', 'verifying', 'recovered']);
    expect(plan.start[key]).toBe(value);
    expect(plan.final[key]).toBe(CARWASH_BASELINE[key]);
    expect(carwashZone(key, plan.final[key])).toBe('normal');
    expect(plan.requiresAttention).toBe(false);
    // Честная оговорка обязательна: модуль ведёт доску и пороги, но не машины.
    expect(plan.steps[1]?.message.length).toBeGreaterThan(60);
  });
});
