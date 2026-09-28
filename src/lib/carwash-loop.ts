import { CARWASH_LAYOUT as L, carPose, type CarWashView } from './carwash-layout';
import type { CarWashPhase } from './carwash-simulation';

export const TOUR_SPEED = 1.5;
const BASE_VISIT = 36.5;
export const VISIT_SECONDS = BASE_VISIT / TOUR_SPEED;
const BOX_ORDER = [2, 1, 3] as const;
const SHOTS: Array<{
  end: number;
  view: CarWashView;
  phase: CarWashPhase;
  title: string;
  message: string;
  tone: 'info' | 'success' | 'progress';
}> = [
  {
    end: 7,
    view: 'arrival',
    phase: 'detecting',
    title: 'Машина заезжает',
    tone: 'info',
    message:
      'Камера замечает автомобиль и открывает визит. Остальные боксы продолжают работать.',
  },
  {
    end: 14,
    view: 'recognition',
    phase: 'evaluating',
    title: 'Номер распознан',
    tone: 'success',
    message: 'Номер, автомобиль и время въезда появляются в системе автоматически.',
  },
  {
    end: 17,
    view: 'hardware',
    phase: 'evaluating',
    title: 'Визит передан в CRM',
    tone: 'success',
    message: 'Мини-ПК обрабатывает события камер и связывает бокс с журналом визитов.',
  },
  {
    end: 22.5,
    view: 'order',
    phase: 'correcting',
    title: 'Заказ взят в работу',
    tone: 'success',
    message:
      'Администратор подтверждает услуги и назначает исполнителя — заказ связан с машиной.',
  },
  {
    end: 29.5,
    view: 'washing',
    phase: 'correcting',
    title: 'Мойка в работе',
    tone: 'progress',
    message: 'Система контролирует занятость бокса и длительность работы над заказом.',
  },
  {
    end: 35,
    view: 'departure',
    phase: 'verifying',
    title: 'Заказ выполнен',
    tone: 'success',
    message: 'Автомобиль выезжает. Камера фиксирует окончание визита и сверяет его с заказом.',
  },
  {
    end: BASE_VISIT,
    view: 'departure',
    phase: 'recovered',
    title: 'Выезд зафиксирован',
    tone: 'success',
    message:
      'Номер, время и выполненные услуги сохранены. Бокс готов принять следующую машину.',
  },
];
const smooth = (n: number) => {
  const t = Math.max(0, Math.min(1, n));
  return t * t * (3 - 2 * t);
};
const plate = (box: number, generation: number) =>
  `${100 + ((box * 153 + generation * 79) % 899)} ${['AKM', 'BJV', 'KZN'][box - 1]} 05`;

export interface TourCar {
  motion: 'arrival' | 'departure' | 'parked' | 'absent';
  z: number;
  opacity: number;
  washing: boolean;
  reading: boolean;
  plate: string;
}
function arrival(time: number): Pick<TourCar, 'motion' | 'z' | 'opacity'> {
  return {
    motion: 'arrival',
    z: carPose('arrival', (time - 0.8) / 4.5).z,
    opacity: smooth(time / 0.8),
  };
}
function departure(time: number): Pick<TourCar, 'motion' | 'z' | 'opacity'> {
  // Fade starts only once the complete car is outside the bay.
  return {
    motion: 'departure',
    z: carPose('departure', time / 4.5).z,
    opacity: 1 - smooth((time - 4.5) / 1),
  };
}

/** One deterministic clock drives every car, camera shot, monitor and notification. */
export function carwashLoop(elapsedSeconds: number) {
  const base = Math.max(0, elapsedSeconds) * TOUR_SPEED;
  const visit = Math.floor(base / BASE_VISIT);
  const time = base - visit * BASE_VISIT;
  const slot = visit % 3;
  const focusBox = BOX_ORDER[slot]!;
  const nextBox = BOX_ORDER[(slot + 1) % 3]!;
  const shotIndex = SHOTS.findIndex((shot) => time < shot.end);
  const shot = SHOTS[shotIndex]!;
  const start = shotIndex ? SHOTS[shotIndex - 1]!.end : 0;
  const cars = [1, 2, 3].map((box): TourCar => {
    const hero = box === focusBox,
      next = box === nextBox;
    const generation = hero
      ? Math.floor(visit / 3) * 2 + 1
      : next
        ? Math.floor((visit + 1) / 3) * 2
        : Math.floor((visit + 2) / 3) * 2;
    const state: TourCar = {
      motion: 'parked',
      z: L.parkZ,
      opacity: 1,
      washing: false,
      reading: false,
      plate: plate(box, generation),
    };
    if (hero) {
      if (time < 7) Object.assign(state, arrival(time));
      else if (time >= 29.5) Object.assign(state, departure(time - 29.5));
      state.washing = shot.view === 'washing';
      state.reading = shot.view === 'recognition' || (time >= 29.5 && time < 34);
    } else if (next) Object.assign(state, departure(time));
    else if (visit === 0) state.washing = true;
    else if (time < 7) {
      state.motion = 'absent';
      state.z = L.arrivalZ;
      state.opacity = 0;
    } else if (time < 14) Object.assign(state, arrival(time - 7));
    else state.washing = true;
    return state;
  });
  return {
    ...shot,
    focusBox,
    cars,
    visit,
    key: `${visit}-${shotIndex}`,
    duration: (shot.end - start) / TOUR_SPEED,
    detail: `Бокс ${focusBox} · ${cars[focusBox - 1]!.plate}`,
  };
}
