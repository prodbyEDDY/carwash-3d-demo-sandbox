/**
 * Общие формы отраслевых демо-сцен (ферма, строительная площадка, …).
 * Публичный API конкретных библиотек симуляции не меняется — они лишь
 * переиспользуют фазовый union, диапазоны и структуру планов.
 */

export type IndustryPhase =
  | 'stable'
  | 'adjusting'
  | 'detecting'
  | 'evaluating'
  | 'correcting'
  | 'verifying'
  | 'recovered'
  | 'requires-attention';

export type IndustryZone = 'normal' | 'warning' | 'critical';

export interface MetricRange {
  min: number;
  max: number;
  step: number;
  warningLow: number;
  safeLow: number;
  safeHigh: number;
  warningHigh: number;
}

export interface DemoScenarioStep<Snapshot, Hotspot extends string> {
  phase: IndustryPhase;
  duration: number;
  message: string;
  patch?: Partial<Snapshot>;
  hotspot: Hotspot;
  notification?: string;
}

export interface DemoScenarioPlan<Snapshot, Hotspot extends string> {
  label: string;
  start: Snapshot;
  final: Snapshot;
  requiresAttention: boolean;
  steps: Array<DemoScenarioStep<Snapshot, Hotspot>>;
}

/** Шаг читается человеком: пауза не короче семи секунд. */
export const READABLE_STEP_MS = 7_000;
/** Коррекция дольше — на ней происходит видимое изменение сцены. */
export const CORRECTION_STEP_MS = 8_500;

/** Этапы реакции, которые показывает панель статуса. */
export const DEMO_PROCESS_PHASES: IndustryPhase[] = ['detecting', 'evaluating', 'correcting', 'verifying'];

export function metricZone(range: MetricRange, value: number): IndustryZone {
  if (value >= range.safeLow && value <= range.safeHigh) return 'normal';
  if (value >= range.warningLow && value <= range.warningHigh) return 'warning';
  return 'critical';
}
