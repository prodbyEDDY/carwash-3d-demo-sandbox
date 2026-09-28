import type { CarWashScenarioKey } from './carwash-simulation';
import type { CarWashView } from './carwash-layout';

type Tone = 'success' | 'info' | 'warning' | 'progress';
type EventSpec = readonly [title: string, tone: Tone];
const EVENTS: Record<CarWashScenarioKey | 'manual', readonly EventSpec[]> = {
  'normal-visit': [
    ['Машина замечена', 'info'],
    ['Номер распознан', 'success'],
    ['Заказ принят', 'success'],
    ['Мойка в работе', 'progress'],
    ['Заказ выполнен', 'success'],
    ['Выезд зафиксирован', 'success'],
  ],
  'no-order': [
    ['Машина замечена', 'info'],
    ['Номер распознан', 'success'],
    ['Замечено нарушение', 'warning'],
    ['Машина уехала без заказа', 'warning'],
    ['Нарушение отправлено владельцу', 'warning'],
  ],
  'time-mismatch': [
    ['Заказ закрыт', 'success'],
    ['Машина ещё в боксе', 'info'],
    ['Расхождение по времени', 'warning'],
    ['Нарушение на проверке', 'info'],
    ['Причина расхождения сохранена', 'success'],
  ],
  'node-offline': [
    ['Нет связи с Node', 'warning'],
    ['Заказ введён вручную', 'info'],
    ['События сохраняются на Node', 'info'],
    ['Связь восстановлена', 'success'],
    ['Журнал синхронизирован', 'success'],
  ],
  'back-to-back': [
    ['Замечена следующая машина', 'info'],
    ['Распознан другой номер', 'success'],
    ['Создан отдельный заказ', 'success'],
    ['Два визита в журнале', 'success'],
    ['Сессии разделены', 'success'],
  ],
  manual: [
    ['Параметр изменён', 'info'],
    ['Проверяем нагрузку', 'progress'],
    ['Настройки адаптированы', 'success'],
    ['Проверяем результат', 'progress'],
    ['Проверка завершена', 'success'],
  ],
};

export function carwashEvent(
  scenario: CarWashScenarioKey | 'manual',
  step: number,
  box: number,
  plate?: string | null,
) {
  const [title, tone] = EVENTS[scenario][step] ?? ['Проверка завершена', 'info'];
  const shots: Record<CarWashScenarioKey | 'manual', CarWashView[]> = {
    'normal-visit': ['arrival', 'recognition', 'order', 'washing', 'departure', 'departure'],
    'no-order': ['arrival', 'recognition', 'washing', 'departure', 'departure'],
    'time-mismatch': ['order', 'recognition', 'recognition', 'order', 'overview'],
    'node-offline': ['hardware', 'order', 'hardware', 'hardware', 'overview'],
    'back-to-back': ['departure', 'arrival', 'order', 'order', 'overview'],
    manual: ['overview', 'hardware', 'order', 'overview', 'overview'],
  };
  return {
    title,
    tone,
    view: shots[scenario][step] ?? 'overview',
    detail: [`Бокс ${box}`, plate].filter(Boolean).join(' · '),
  };
}

/** Quintic easing has zero velocity and acceleration at both ends of a camera move. */
export function cameraEase(progress: number) {
  const t = Math.max(0, Math.min(1, progress));
  return t * t * t * (t * (t * 6 - 15) + 10);
}
