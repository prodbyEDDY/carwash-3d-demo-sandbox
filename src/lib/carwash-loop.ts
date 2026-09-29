import { CARWASH_LAYOUT as L, carPose, type CarWashView } from './carwash-layout';
import type { CarWashPhase } from './carwash-simulation';

export const TOUR_SPEED = 1.5;
const BASE_VISIT = 36.5;
export const VISIT_SECONDS = BASE_VISIT / TOUR_SPEED;
const BOX_ORDER = [2, 1, 3] as const;

/** Сценарии, которые реально проигрываются в 3D. Остальные ключи живут пока только в планах. */
export type CarWashTourKey = 'normal-visit' | 'unknown-car' | 'other-service';

/**
 * Треугольник на записи визита в системе: `review` — жёлтый, визит ждёт разбора,
 * `unpaid` — красный, оплата не внесена. Флаг держится на записи и после выезда машины.
 */
export type CarWashAlert = 'none' | 'review' | 'unpaid';

/**
 * Сигнал службе контроля. В отличие от `CarWashAlert` сотрудник его не видит:
 * на мониторе мойщика всё зелёное, расхождение уходит только на терминал администратора.
 */
export type CarWashStaffAlert = 'none' | 'service-mismatch';

/** Заказ и факт по услуге: что оплачивал клиент и что пробили по факту. */
export interface CarWashService {
  ordered: string;
  performed: string;
  /** Короткая подпись для 3D-монитора, где весь интерфейс набран по-английски. */
  performedShort: string;
  orderedMinutes: number;
  performedMinutes: number;
  orderedPrice: number;
  performedPrice: number;
}

interface Shot {
  end: number;
  view: CarWashView;
  phase: CarWashPhase;
  title: string;
  message: string;
  tone: 'info' | 'success' | 'progress' | 'warning';
  /** Флаг на записи визита; пусто значит « flag держится с прошлого шага ». */
  alert?: CarWashAlert;
  /** Сигнал службе контроля; держится так же, как флаг сотрудника. */
  staffAlert?: CarWashStaffAlert;
  /** Показать пуш собственнику на телефон. */
  phone?: boolean;
}

const SHOTS: Shot[] = [
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
/**
 * «Машина не из списка»: заезд и чтение номера — как в обычном визите, дальше визит
 * добавляется в журнал с жёлтым треугольником, а если оплата так и не внесена, значок
 * краснеет и собственнику уходит пуш. Начало совпадает с обычным визитом намеренно:
 * разница начинается только после сверки номера с системой.
 */
const UNKNOWN_CAR_SHOTS: Shot[] = [
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
    tone: 'info',
    message: 'Номер и время въезда появляются в системе автоматически, без звонка админу.',
  },
  {
    end: 21,
    view: 'recognition',
    phase: 'evaluating',
    title: 'В системе такого номера нет',
    tone: 'warning',
    message:
      'Node сверяет прочитанный номер со списком клиентов и не находит совпадения: машины нет в системе, а запись в CRM осталась от другой.',
  },
  {
    end: 27,
    view: 'order',
    phase: 'correcting',
    title: 'Визит добавлен с предупреждением',
    tone: 'warning',
    alert: 'review',
    message:
      'Визит всё равно записан в журнал — но с жёлтым треугольником. Мойка не срывается: машина получит услугу, а админ разберётся с номером позже.',
  },
  {
    end: 37,
    view: 'washing',
    phase: 'correcting',
    title: 'Мойка в работе',
    tone: 'progress',
    message: 'Мойщик моет машину, камера ведёт сессию и считает, сколько времени занял бокс.',
  },
  {
    end: 44,
    view: 'departure',
    phase: 'verifying',
    title: 'Выезд, сверка времени',
    tone: 'success',
    message:
      'Машина выехала. Длительность визита сошлась с временем в боксе — расхождения по времени нет.',
  },
  {
    end: 51,
    view: 'order',
    phase: 'verifying',
    title: 'Ждём оплату от мойщика',
    tone: 'info',
    message: 'Осталось внести оплату в CRM: без неё визит не закрывается, а жёлтый треугольник горит.',
  },
  {
    end: 64,
    view: 'overview',
    phase: 'requires-attention',
    title: 'Оплата не внесена — пуш собственнику',
    tone: 'warning',
    alert: 'unpaid',
    phone: true,
    message:
      'Оплаты по мойке нет. Жёлтый треугольник стал красным, а собственнику ушло уведомление на телефон: проверьте мойку, такое-то время и такая-то машина.',
  },
];

interface TourProfile {
  shots: Shot[];
  /** Полная длительность визита в базовых секундах. */
  visit: number;
  /** Момент, когда машина бокса начинает выезд. */
  departAt: number;
  /** До какого момента камера продолжает читать номер на выезде. */
  readUntil: number;
  /** Услуга по сценарию; в обычном визите её нет. */
  service?: CarWashService;
}

/**
 * Третий сценарий: в заказе комплексная мойка, по факту пробита короткая.
 * Первые два шага не отличить от обычного визита — расхождение появляется только
 * на выборе услуги, и до сотрудника оно не доходит: монитор остаётся зелёным,
 * статус визита успешный, треугольника нет. Сигнал уходит на терминал службы
 * контроля, где и видно, что в боксе провели 20 минут вместо 60.
 */
const OTHER_SERVICE: CarWashService = {
  ordered: 'Комплексная мойка',
  performed: 'Мойка кузова',
  performedShort: 'BODY WASH',
  orderedMinutes: 60,
  performedMinutes: 20,
  orderedPrice: 4900,
  performedPrice: 1900,
};

const OTHER_SERVICE_SHOTS: Shot[] = [
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
    message: 'Номер и время въезда появляются в системе автоматически, без звонка админу.',
  },
  {
    end: 21,
    view: 'order',
    phase: 'evaluating',
    title: 'Запись найдена, всё в порядке',
    tone: 'success',
    message:
      'Номер есть в журнале, машина известна. В записи комплексная мойка на 60 минут — сотруднику пока нечего проверять.',
  },
  {
    end: 27,
    view: 'order',
    phase: 'correcting',
    title: 'Мойщик пробивает услугу',
    tone: 'progress',
    message:
      'В CRM попадает не комплексная мойка, а короткая «мойка кузова». Система принимает выбор молча: подмену услуги сотрудник не видит.',
  },
  {
    end: 37,
    view: 'washing',
    phase: 'correcting',
    title: 'Мойка в работе',
    tone: 'progress',
    message:
      'Мойщик моет кузов и заканчивает раньше срока. Камера честно считает фактическое время в боксе — 20 минут вместо 60.',
  },
  {
    end: 44,
    view: 'departure',
    phase: 'verifying',
    title: 'Выезд, сверка времени',
    tone: 'success',
    message:
      'Машина выехала, бокс освободился за 20 минут. Время в боксе сходится с фактом, а заказ ждёт 60 — сверка пока ничего не сообщает.',
  },
  {
    end: 51,
    view: 'order',
    phase: 'verifying',
    title: 'Оплата прошла',
    tone: 'success',
    message:
      '1 900 ₽ по позиции «мойка кузова». Для сотрудника визит закрыт: все статусы зелёные, претензий нет.',
  },
  {
    end: 64,
    view: 'overview',
    phase: 'verifying',
    title: 'Сигнал в службу контроля',
    tone: 'success',
    staffAlert: 'service-mismatch',
    message:
      'Заказ — комплексная мойка, факт — кузов, 20 минут вместо 60. Терминал администратора получает сигнал о вероятной краже услуги; мойщик о нём не узнаёт.',
  },
];

const PROFILES: Record<CarWashTourKey, TourProfile> = {
  'normal-visit': { shots: SHOTS, visit: BASE_VISIT, departAt: 29.5, readUntil: 34 },
  'unknown-car': { shots: UNKNOWN_CAR_SHOTS, visit: 64, departAt: 37, readUntil: 42 },
  'other-service': {
    shots: OTHER_SERVICE_SHOTS,
    visit: 64,
    departAt: 37,
    readUntil: 42,
    service: OTHER_SERVICE,
  },
};

/** Длительность одного визита выбранного сценария в секундах стенного времени. */
export function carwashTourSeconds(key: CarWashTourKey) {
  return PROFILES[key].visit / TOUR_SPEED;
}

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
  /** Флаг на записи визита в системе: жёлтый треугольник или красный. */
  alert: CarWashAlert;
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
export function carwashLoop(elapsedSeconds: number, scenario: CarWashTourKey = 'normal-visit') {
  const profile = PROFILES[scenario] ?? PROFILES['normal-visit'];
  const shots = profile.shots;
  const base = Math.max(0, elapsedSeconds) * TOUR_SPEED;
  const visit = Math.floor(base / profile.visit);
  const time = base - visit * profile.visit;
  const slot = visit % 3;
  const focusBox = BOX_ORDER[slot]!;
  const nextBox = BOX_ORDER[(slot + 1) % 3]!;
  const shotIndex = shots.findIndex((shot) => time < shot.end);
  const shot = shots[shotIndex]!;
  const start = shotIndex ? shots[shotIndex - 1]!.end : 0;
  // Флаг держится на записи визита: ищем последний заданный флаг среди уже показанных
  // кадров, а не только у предыдущего — между «желтым» и «красным» есть шаги без своего флага.
  let alert: CarWashAlert = 'none';
  for (let index = 0; index <= shotIndex; index++) {
    const defined = shots[index]!.alert;
    if (defined) alert = defined;
  }
  // Сигнал контролю ищется так же, как флаг сотрудника, но живёт отдельным каналом:
  // в сценарии подмены услуги треугольника на записи нет, а сигнал есть.
  let staffAlert: CarWashStaffAlert = 'none';
  for (let index = 0; index <= shotIndex; index++) {
    const defined = shots[index]!.staffAlert;
    if (defined) staffAlert = defined;
  }
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
      alert: 'none',
    };
    if (hero) {
      if (time < 7) Object.assign(state, arrival(time));
      else if (time >= profile.departAt) Object.assign(state, departure(time - profile.departAt));
      state.washing = shot.view === 'washing';
      state.reading = shot.view === 'recognition' || (time >= profile.departAt && time < profile.readUntil);
      state.alert = alert;
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
    scenario,
    alert,
    staffAlert,
    service: profile.service ?? null,
    focusBox,
    cars,
    visit,
    // Сценарий в ключе: переключение селекта должно перерисовать уведомление.
    key: `${scenario}-${visit}-${shotIndex}`,
    duration: (shot.end - start) / TOUR_SPEED,
    detail: `Бокс ${focusBox} · ${cars[focusBox - 1]!.plate}`,
  };
}
