import {
  CORRECTION_STEP_MS,
  metricZone,
  READABLE_STEP_MS,
  type DemoScenarioPlan,
  type DemoScenarioStep,
  type IndustryPhase,
  type IndustryZone,
  type MetricRange,
} from './industry-demo';

/**
 * Демо-сцена автомойки: CRM с камерным контролем боксов.
 * Смысл сцены взят из `docs/superpowers/specs/2026-09-17-carwash-crm-platform-design.md`
 * (§1 ценность камер, §4 камерный контур, §5.1 доска боксов): камера бокса —
 * точка контроля, заказ рождается из факта заезда, а расхождения поднимаются
 * нарушениями со снимком.
 *
 * Отличие от соседних отраслевых библиотек: кроме числовых метрик сценарий
 * ведёт ещё и доску боксов (номер, марка, таймер) и счётчик нарушений —
 * ценность модуля видна именно на доске, а не на градуснике.
 */

export type CarWashScenarioKey =
  | 'normal-visit'
  | 'no-order'
  | 'time-mismatch'
  | 'node-offline'
  | 'back-to-back';
export type CarWashPhase = IndustryPhase;
export type CarWashHotspotId = 'node' | 'camera' | 'box' | 'entrance' | 'tablet' | 'washer';

export interface CarWashSnapshot {
  /** Сколько боксов под навесом, шт. */
  boxes: number;
  /** Поток машин в час на всю мойку. */
  flow: number;
  /** Порог «открыта без заказа», мин (spec §3: `no_order_after_min`). */
  noOrderMin: number;
}

export type CarWashMetricKey = keyof CarWashSnapshot;
export type CarWashZone = IndustryZone;
export type CarWashRange = MetricRange;

/** Состояние плитки бокса на доске (spec §5.1). */
export type CarWashBoxStatus = 'free' | 'busy' | 'ordered' | 'violation' | 'offline';

export interface CarWashBoxCard {
  /** Номер бокса, 1-based. */
  box: number;
  status: CarWashBoxStatus;
  /** Номер машины, прочитанный камерой; null — ещё не прочитан. */
  plate: string | null;
  /** Марка и модель из облачного распознавания по снимку. */
  make: string | null;
  /** Таймер сессии, с; демо тикает его сама, шаг задаёт только точку отсчёта. */
  seconds: number | null;
  /** Короткая подпись под строкой плитки. */
  note: string | null;
}

/** Патч одной плитки: шаг сценария меняет только то, что действительно меняется. */
export type CarWashBoxPatch = { box: number } & Partial<Omit<CarWashBoxCard, 'box'>>;

export interface CarWashScenarioStep extends DemoScenarioStep<CarWashSnapshot, CarWashHotspotId> {
  /** Изменения плиток доски на этом шаге. */
  board?: CarWashBoxPatch[];
  /** Абсолютное значение счётчика нарушений после шага. */
  violations?: number;
}

export interface CarWashScenarioPlan extends DemoScenarioPlan<CarWashSnapshot, CarWashHotspotId> {
  steps: CarWashScenarioStep[];
  /** Бокс, вокруг которого крутится сценарий: сцена подсвечивает именно его. */
  focusBox: number;
  /** Счётчик нарушений на старте сценария. */
  violations: number;
}

export const CARWASH_BASELINE: CarWashSnapshot = {
  boxes: 3,
  flow: 9,
  noOrderMin: 10,
};

/**
 * Боксов всегда «нормально»: ползунок здесь структурный, он перестраивает сцену,
 * а не выводит параметр из коридора. Поток и порог — настоящие коридоры:
 * слишком плотный поток ломает сверку, слишком короткий порог сыплет ложными
 * нарушениями (spec §6: «ложное нарушение → пороги настраиваемы по мойке»).
 */
export const CARWASH_RANGES: Record<CarWashMetricKey, CarWashRange> = {
  boxes: { min: 2, max: 4, step: 1, warningLow: 2, safeLow: 2, safeHigh: 4, warningHigh: 4 },
  flow: { min: 2, max: 24, step: 1, warningLow: 4, safeLow: 6, safeHigh: 14, warningHigh: 18 },
  noOrderMin: { min: 3, max: 30, step: 1, warningLow: 5, safeLow: 7, safeHigh: 15, warningHigh: 20 },
};

/** Доска на старте: все боксы свободны. */
export function carwashIdleBoard(boxes: number): CarWashBoxCard[] {
  return Array.from({ length: boxes }, (_unused, index) => ({
    box: index + 1,
    status: 'free' as const,
    plate: null,
    make: null,
    seconds: null,
    note: null,
  }));
}

/** Наложение патчей шага на доску. Плитки вне текущего числа боксов игнорируются. */
export function carwashApplyBoard(board: CarWashBoxCard[], patches: CarWashBoxPatch[]): CarWashBoxCard[] {
  return board.map((card) => {
    const patch = patches.find((item) => item.box === card.box);
    return patch ? { ...card, ...patch } : card;
  });
}

const plan = (
  label: string,
  focusBox: number,
  steps: CarWashScenarioStep[],
  requiresAttention = false,
  bounds: { start?: Partial<CarWashSnapshot>; final?: Partial<CarWashSnapshot> } = {},
): CarWashScenarioPlan => ({
  label,
  focusBox,
  violations: 0,
  start: { ...CARWASH_BASELINE, ...bounds.start },
  final: { ...CARWASH_BASELINE, ...bounds.final },
  steps,
  requiresAttention,
});

const PLANS: Record<CarWashScenarioKey, CarWashScenarioPlan> = {
  'normal-visit': plan('Обычный визит', 2, [
    {
      phase: 'detecting', duration: READABLE_STEP_MS, hotspot: 'entrance',
      message: 'Машина заехала в бокс 2. Трек попал в зону бокса — камера открыла сессию, доска показала занятость раньше, чем админ поднял голову.',
      board: [{ box: 2, status: 'busy', seconds: 0, note: 'Сессия открыта' }],
    },
    {
      phase: 'evaluating', duration: READABLE_STEP_MS, hotspot: 'camera',
      message: 'Камера прочитала номер при заезде: 559 BJV 05. Лучший кадр трека ушёл в облако — марка и кузов вернулись за пару секунд.',
      board: [{ box: 2, plate: '559 BJV 05', make: 'BMW M4', note: 'Номер с камеры' }],
    },
    {
      phase: 'correcting', duration: CORRECTION_STEP_MS, hotspot: 'tablet',
      message: 'Админ оформляет заказ одним тапом прямо из плитки: услуги подставлены по кузову, мойщик назначен. Заказ родился из факта заезда, а не наоборот.',
      board: [{ box: 2, status: 'ordered', note: 'Комплекс · мойщик Азамат' }],
      notification: 'Бокс 2 · 559 BJV 05 · заказ оформлен',
    },
    {
      phase: 'correcting', duration: READABLE_STEP_MS, hotspot: 'washer',
      message: 'Мойщик выполняет заказ. Камера продолжает вести сессию: видно, какой автомобиль в боксе и сколько времени занимает работа.',
      board: [{ box: 2, status: 'ordered', note: 'Мойка в работе · Азамат' }],
    },
    {
      phase: 'verifying', duration: READABLE_STEP_MS, hotspot: 'box',
      message: 'Выезд: трек ушёл из зоны, сессия закрыта. Сверка сошлась — длительность сессии и заказа совпали, нарушений нет.',
      board: [{ box: 2, status: 'ordered', note: 'Сессия закрыта, сверка сошлась' }],
    },
    {
      phase: 'recovered', duration: 0, hotspot: 'node',
      message: 'Визит лёг в журнал целиком: номер, марка, время, услуги, мойщик и оплата. Бокс снова свободен.',
      board: [{ box: 2, status: 'free', plate: null, make: null, seconds: null, note: null }],
    },
  ]),

  'no-order': plan('Машина без заказа', 3, [
    {
      phase: 'detecting', duration: READABLE_STEP_MS, hotspot: 'entrance',
      message: 'В бокс 3 заехала машина. Сессия открыта камерой, но в CRM по этому боксу нет ни одного открытого заказа.',
      board: [{ box: 3, status: 'busy', seconds: 0, note: 'Заказа нет' }],
    },
    {
      phase: 'evaluating', duration: READABLE_STEP_MS, hotspot: 'camera',
      message: 'Номер прочитан: 847 ABC 02, BMW M4. Машина стоит, мойщик работает, а в журнале мойки её нет.',
      board: [{ box: 3, plate: '847 ABC 02', make: 'BMW M4', note: 'В журнале пусто' }],
    },
    {
      phase: 'correcting', duration: CORRECTION_STEP_MS, hotspot: 'node',
      message: 'Порог «без заказа» пройден. Node поднимает напоминание админу и владельцу: бокс занят дольше порога, заказа нет. Плитка загорается нарушением.',
      board: [{ box: 3, status: 'violation', note: 'Открыта без заказа' }],
      notification: 'Бокс 3 · 847 ABC 02 · открыта без заказа',
    },
    {
      phase: 'verifying', duration: READABLE_STEP_MS, hotspot: 'tablet',
      message: 'Заказ так и не появился, машина выехала. Сессия закрыта без заказа — нарушение «машина без заказа» со снимком ушло в ленту владельца.',
      board: [{ box: 3, status: 'violation', note: 'Нарушение · снимок приложен' }],
      violations: 1,
    },
    {
      phase: 'requires-attention', duration: 0, hotspot: 'box',
      message: 'Дальше работает человек: владелец открывает ленту, смотрит кадр и ставит причину. Система не обвиняет — она приносит факт с картинкой.',
    },
  ], true),

  'time-mismatch': plan('Расхождение по времени', 1, [
    {
      phase: 'detecting', duration: READABLE_STEP_MS, hotspot: 'tablet',
      message: 'Заказ по боксу 1 закрыт и оплачен: 1 200 ₸, наличными. Для CRM машина уже уехала.',
      board: [{ box: 1, status: 'ordered', plate: '123 KZN 05', make: 'BMW M4', seconds: 1_420, note: 'Заказ закрыт' }],
    },
    {
      phase: 'evaluating', duration: READABLE_STEP_MS, hotspot: 'camera',
      message: 'Камера с этим не согласна: тот же трек всё ещё в зоне бокса. Сессия не закрывалась ни на секунду.',
      board: [{ box: 1, note: 'Сессия ещё открыта' }],
    },
    {
      phase: 'correcting', duration: CORRECTION_STEP_MS, hotspot: 'node',
      message: 'Разрыв перевалил за порог расхождения. Поднято нарушение «расхождение по времени»: два таймлайна рядом, заказ и сессия.',
      board: [{ box: 1, status: 'violation', note: 'Расхождение по времени' }],
      notification: 'Бокс 1 · 123 KZN 05 · расхождение по времени',
      violations: 1,
    },
    {
      phase: 'verifying', duration: READABLE_STEP_MS, hotspot: 'tablet',
      message: 'Владелец открывает карточку: снимок, время заказа, время сессии. Видно, что машину домывали уже после оплаты.',
      board: [{ box: 1, note: 'Разбор: домывали после оплаты' }],
    },
    {
      phase: 'recovered', duration: 0, hotspot: 'node',
      message: 'Нарушение закрыто с причиной — это не ошибка кассы. Порог расхождения по этой мойке можно поднять, чтобы такие случаи не шумели.',
      board: [{ box: 1, status: 'free', plate: null, make: null, seconds: null, note: null }],
    },
  ]),

  'node-offline': plan('Нода офлайн', 2, [
    {
      phase: 'detecting', duration: READABLE_STEP_MS, hotspot: 'node',
      message: 'Интернет на объекте пропал. Мини-ПК в подсобке не виден серверу — доска честно гасит плитки и пишет «камеры офлайн».',
      board: [
        { box: 1, status: 'offline', note: 'Камеры офлайн' },
        { box: 2, status: 'offline', note: 'Камеры офлайн' },
        { box: 3, status: 'offline', note: 'Камеры офлайн' },
        { box: 4, status: 'offline', note: 'Камеры офлайн' },
      ],
    },
    {
      phase: 'evaluating', duration: READABLE_STEP_MS, hotspot: 'tablet',
      message: 'Мойка не встаёт: CRM продолжает работать как без комплекта, админ ведёт заказы руками. Нарушения «заказ без машины» за время офлайна не поднимаются.',
      board: [{ box: 2, status: 'ordered', plate: '— ручной ввод', make: 'BMW M4', seconds: 0, note: 'Заказ вручную' }],
    },
    {
      phase: 'correcting', duration: CORRECTION_STEP_MS, hotspot: 'node',
      message: 'На объекте всё живо: детекция и чтение номеров идут локально, события копятся в дисковом буфере. Ничего не удаляется без подтверждения сервера.',
      notification: 'Нода офлайн · события пишутся в буфер',
    },
    {
      phase: 'verifying', duration: READABLE_STEP_MS, hotspot: 'node',
      message: 'Связь вернулась. Буфер догоняет сервер: сессии доезжают с исходными временами, а не временем доставки.',
      board: [
        { box: 1, status: 'free', note: null },
        { box: 2, status: 'ordered', plate: '559 BJV 05', note: 'Сессия доехала из буфера' },
        { box: 3, status: 'free', note: null },
        { box: 4, status: 'free', note: null },
      ],
    },
    {
      phase: 'recovered', duration: 0, hotspot: 'box',
      message: 'Сверка прошла задним числом: ручной заказ склеился с догнавшей сессией. Доска снова живая, дыры в журнале нет.',
      board: [{ box: 2, status: 'free', plate: null, make: null, seconds: null, note: null }],
    },
  ]),

  'back-to-back': plan('Две машины подряд в одном боксе', 2, [
    {
      phase: 'detecting', duration: READABLE_STEP_MS, hotspot: 'box',
      message: 'В боксе 2 закрылась сессия: 559 BJV 05 выехал. Через сорок секунд в тот же бокс заезжает следующая машина.',
      board: [{ box: 2, status: 'busy', plate: null, make: null, seconds: 0, note: 'Новый трек' }],
    },
    {
      phase: 'evaluating', duration: READABLE_STEP_MS, hotspot: 'camera',
      message: 'Зазор меньше двух минут — это повод заподозрить развалившийся трек одной машины. Решает номер: камера читает 123 KZN 05, а уехал 559 BJV 05.',
      board: [{ box: 2, plate: '123 KZN 05', make: 'BMW M4', note: 'Номер другой' }],
    },
    {
      phase: 'correcting', duration: CORRECTION_STEP_MS, hotspot: 'node',
      message: 'Склейка не применяется: номера разные, значит это вторая машина, а не продолжение первой. Открыта новая сессия, таймер пошёл с нуля.',
      board: [{ box: 2, status: 'ordered', note: 'Вторая сессия · заказ свой' }],
      notification: 'Бокс 2 · вторая машина · склейка не применена',
    },
    {
      phase: 'verifying', duration: READABLE_STEP_MS, hotspot: 'tablet',
      message: 'В журнале две отдельные строки с двумя заказами и двумя суммами. Один визит не съел второй — и наоборот.',
      board: [{ box: 2, note: 'Две строки в журнале' }],
    },
    {
      phase: 'recovered', duration: 0, hotspot: 'node',
      message: 'Тот же зазор при совпавшем или пустом номере склеил бы треки в одну сессию. Порядок решает номер, а не тайминг.',
      board: [{ box: 2, status: 'free', plate: null, make: null, seconds: null, note: null }],
    },
  ]),
};

export function carwashScenarioPlan(key: CarWashScenarioKey): CarWashScenarioPlan {
  return PLANS[key];
}

export function carwashZone(key: CarWashMetricKey, value: number): CarWashZone {
  return metricZone(CARWASH_RANGES[key], value);
}

interface AdjustmentConfig {
  label: string;
  sensor: CarWashHotspotId;
  actuator: CarWashHotspotId;
  lowAction: string;
  highAction: string;
  /** Честная оговорка: чего модуль делать не станет. */
  honesty: string;
}

const adjustmentConfig: Record<CarWashMetricKey, AdjustmentConfig | null> = {
  // Боксы перестраивают сцену, а не выводят параметр из коридора: коррекции нет.
  boxes: null,
  flow: {
    label: 'потока машин',
    sensor: 'entrance',
    actuator: 'tablet',
    lowAction: 'снимает очередь с доски: боксы простаивают, и напоминания «без заказа» только мешали бы админу',
    highAction: 'разводит поток по свободным боксам и поднимает порог напоминаний: в пик админ физически не успевает оформить за десять минут',
    honesty: 'Машинами модуль не управляет — он ведёт доску и пороги, а очередь разводит человек.',
  },
  noOrderMin: {
    label: 'порога «без заказа»',
    sensor: 'node',
    actuator: 'node',
    lowAction: 'возвращает порог к рабочему: слишком короткий порог сыплет ложными нарушениями на каждый долгий заезд',
    highAction: 'возвращает порог к рабочему: слишком длинный порог замечает пропущенный заказ уже после выезда машины',
    honesty: 'Порог — настройка мойки: она задаётся в кабинете и действует на все боксы площадки.',
  },
};

/**
 * Ручная правка ползунка вне зелёной зоны разворачивается в тот же пятишаговый
 * цикл, что и сценарии: обнаружение → оценка → коррекция → проверка → итог.
 */
export function carwashAdjustmentPlan(
  snapshot: CarWashSnapshot,
  key: CarWashMetricKey,
  value: number,
): CarWashScenarioPlan | null {
  const range = CARWASH_RANGES[key];
  if (value >= range.safeLow && value <= range.safeHigh) return null;
  const config = adjustmentConfig[key];
  if (!config) return null;

  const current = { ...snapshot, [key]: value };
  const low = value < range.safeLow;
  const target = CARWASH_BASELINE[key];
  const action = low ? config.lowAction : config.highAction;
  const direction = low ? 'ниже' : 'выше';

  return {
    label: `Коррекция ${config.label}`,
    focusBox: 1,
    violations: 0,
    start: current,
    final: { ...current, [key]: target },
    requiresAttention: false,
    steps: [
      {
        phase: 'detecting', duration: READABLE_STEP_MS, hotspot: config.sensor,
        message: `Значение ${config.label} ${direction} демонстрационного диапазона — доска и сверка работают уже в другом режиме.`,
      },
      {
        phase: 'evaluating', duration: READABLE_STEP_MS, hotspot: 'node',
        message: `Orionix Node сверяет режим мойки с порогами площадки и выбирает безопасную настройку. ${config.honesty}`,
      },
      {
        phase: 'correcting', duration: CORRECTION_STEP_MS, hotspot: config.actuator,
        message: `Orionix Node ${action}.`,
        notification: `Автокоррекция: ${config.label}`,
      },
      {
        phase: 'verifying', duration: READABLE_STEP_MS, hotspot: 'tablet', patch: { [key]: target },
        message: `Повторная проверка: значение ${config.label} вернулось в зелёную зону, доска боксов снова читается.`,
      },
      {
        phase: 'recovered', duration: 0, hotspot: 'node',
        message: 'Параметр стабилизирован. Orionix Node продолжает вести сессии боксов и сверку с журналом.',
        notification: 'Параметр снова в зелёной зоне',
      },
    ],
  };
}
