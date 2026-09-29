'use client';

import dynamic from 'next/dynamic';
import {
  CheckIcon,
  CameraIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DemoPanel,
  DemoSceneActions,
  DemoSceneHelp,
  DemoScenarios,
  DemoStatusCard,
} from './industry/DemoPanelUi';
import { Card, CardContent } from './ui/card';
import { CARWASH_BASELINE } from '../lib/carwash-simulation';
import { carwashLoop, type CarWashService, type CarWashTourKey } from '../lib/carwash-loop';

const CarWashScene = dynamic(() => import('./CarWashScene'), { ssr: false });

const CARWASH_SCENARIO_ITEMS: CarWashTourKey[] = ['normal-visit', 'unknown-car', 'other-service'];

/** Время визита для пуша: туманный старт в середине дня плюс ход тура. */
const visitClock = (seconds: number) => {
  const total = 13 * 3600 + 7 * 60 + Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600) % 24;
  const minutes = Math.floor((total % 3600) / 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

/** Сумма в канцелярском виде: 1 900 ₽. */
const sum = (value: number) => `${value.toLocaleString('ru-RU').replace(/[\s ]/g, ' ')} ₽`;

export default function CarWashDemo({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open && !dialogRef.current?.open) dialogRef.current?.showModal();
  }, [open]);
  return (
    <dialog
      ref={dialogRef}
      className="farm-dialog carwash-dialog"
      aria-labelledby="carwash-dialog-title"
      onClose={onClose}
    >
      {open ? <CarWashTour onClose={() => dialogRef.current?.close()} /> : null}
    </dialog>
  );
}

/** Closing unmounts the tour and cancels its clock; reopening starts the opening shot. */
function CarWashTour({ onClose }: { onClose: () => void }) {
  const t = useTranslations('home.industries');
  const elapsed = useRef(0);
  const [scenario, setScenario] = useState<CarWashTourKey>('normal-visit');
  const [tour, setTour] = useState(() => carwashLoop(0));
  const [running, setRunning] = useState(false);
  const [ready, setReady] = useState(false);
  const [resetViewToken, setResetViewToken] = useState(0);
  // Состояние до сценариев: сцена на месте, машины стоят, ни один шаг не начат.
  const idle = useMemo(
    () => ({
      ...carwashLoop(0),
      key: 'idle',
      phase: 'stable' as const,
      view: 'overview' as const,
      title: t('carwashDemo.status.stable'),
      message: t('carwashDemo.status.stable'),
      tone: 'success' as const,
    }),
    [t],
  );
  const frame = running ? tour : idle;
  // Выбранный сценарий — единственный источник истины: и панель, и сцена читают один цикл.
  const runScenario = (key: string) => {
    const next = (CARWASH_SCENARIO_ITEMS.find((item) => item === key) ?? 'normal-visit');
    elapsed.current = 0;
    setScenario(next);
    setTour(carwashLoop(0, next));
    setRunning(true);
  };
  const resetScenario = () => {
    elapsed.current = 0;
    setScenario('normal-visit');
    setTour(carwashLoop(0));
    setRunning(false);
    setResetViewToken((value) => value + 1);
  };
  useEffect(() => {
    if (!ready || !running) return;
    let last = performance.now();
    let key = '';
    const timer = window.setInterval(() => {
      const now = performance.now();
      if (!document.hidden) elapsed.current += (now - last) / 1000;
      last = now;
      const next = carwashLoop(elapsed.current, scenario);
      if (next.key !== key) {
        key = next.key;
        setTour(next);
      }
    }, 16);
    const visibility = () => {
      last = performance.now();
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [ready, running, scenario]);
  return (
    <div className="farm-demo-shell">
      <h2 className="sr-only" id="carwash-dialog-title">
        {t('carwashDemo.title')}
      </h2>
      <div className="farm-demo-grid">
        <div className="farm-visual-column">
          <div className="farm-scene-shell carwash-scene-shell">
            <CarWashScene
              activeHotspot="node"
              focusBox={frame.focusBox}
              guidedCamera
              onHotspotChange={() => {}}
              onOverlayChange={() => {}}
              onReady={() => setReady(true)}
              phase={frame.phase}
              resetViewToken={resetViewToken}
              values={CARWASH_BASELINE}
              tablet={{
                title: 'Orionix Car Control',
                value: frame.cars[frame.focusBox - 1]!.plate,
                note: `Бокс ${frame.focusBox}`,
              }}
              view={frame.view}
              eventTitle={frame.title}
              eventTone={frame.tone}
              tourClock={elapsed}
              scenario={scenario}
            />
            {!ready && (
              <div className="farm-scene-loading">
                <span />
                {t('carwashDemo.sceneLoading')}
              </div>
            )}
            <DemoSceneActions
              resetViewLabel={t('carwashDemo.resetView')}
              closeLabel={t('carwashDemo.close')}
              onResetView={() => setResetViewToken((value) => value + 1)}
              onClose={onClose}
            />
            <DemoSceneHelp
              label={t('carwashDemo.sceneHelp')}
              text={
                <>
                  {t('carwashDemo.sceneHint')}{' '}
                  <a
                    className="underline"
                    href="/models/carwash/ATTRIBUTION.md"
                    target="_blank"
                    rel="noreferrer"
                  >
                    3D: SRT Performance · CC BY 4.0
                  </a>
                </>
              }
            />
            <div
              className="carwash-event-region"
              role="status"
              aria-label="События автомойки"
              aria-live="polite"
              aria-atomic="true"
            >
              {ready && running && <CarWashNotification event={frame} />}
            </div>
            {ready && running && frame.phone && (
              <CarWashOwnerPhone
                box={frame.focusBox}
                clock={visitClock(elapsed.current)}
                plate={frame.cars[frame.focusBox - 1]!.plate}
              />
            )}
            {ready && running && frame.staffAlert === 'service-mismatch' && frame.service && (
              <CarWashStaffTerminal
                box={frame.focusBox}
                clock={visitClock(elapsed.current)}
                plate={frame.cars[frame.focusBox - 1]!.plate}
                service={frame.service}
              />
            )}
          </div>
        </div>
        <DemoPanel disclaimer={t('carwashDemo.disclaimer')}>
          <DemoStatusCard
            phase={frame.phase}
            message={frame.message}
            processLabel={t('carwashDemo.processLabel')}
            processLabels={{
              detecting: t('carwashDemo.phases.detecting'),
              evaluating: t('carwashDemo.phases.evaluating'),
              correcting: t('carwashDemo.phases.correcting'),
              verifying: t('carwashDemo.phases.verifying'),
            }}
          />
          <DemoScenarios
            title={t('carwashDemo.scenariosTitle')}
            runLabel={t('carwashDemo.runScenario')}
            resetLabel={t('carwashDemo.reset')}
            active={null}
            items={CARWASH_SCENARIO_ITEMS.map((key) => ({
              key,
              title: t(`carwashDemo.scenarios.${key}.title`),
            }))}
            onRun={runScenario}
            onReset={resetScenario}
          />
          <Card className="gap-0 py-0">
            <CardContent className="grid gap-4 p-4">
              <div className="grid gap-2">
                <span className="text-xs text-muted-foreground">Orionix Car Control</span>
                <h3 className="text-lg text-foreground">Контроль для вашего автобизнеса</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Автомойка, автосервис или детейлинг — один подход к контролю машин, заказов и
                  работы сотрудников.
                </p>
              </div>
              <div className="flex flex-wrap gap-2" aria-label="Направления автобизнеса">
                {['Автомойки', 'Автосервисы', 'Детейлинг'].map((label) => (
                  <span
                    className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary"
                    key={label}
                  >
                    {label}
                  </span>
                ))}
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Камеры фиксируют номер и время визита. CRM связывает автомобиль с заказом,
                показывает занятость постов и сообщает о расхождениях.
              </p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Подключите существующие камеры через мини-ПК или используйте готовый комплект.
                Начать можно с CRM, а камерный контроль добавить позже.
              </p>
            </CardContent>
          </Card>
        </DemoPanel>
      </div>
    </div>
  );
}

/**
 * Макет телефона собственника: последний шаг сценария — визит без оплаты, и система
 * пишет владельцу, чтобы он открыл журнал и разобрался. Пуш адресован человеку,
 * поэтому и выглядит как обычное уведомление телефона, а не как строка в CRM.
 */
function CarWashOwnerPhone({
  box,
  clock,
  plate,
}: {
  box: number;
  clock: string;
  plate: string;
}) {
  return (
    <div className="carwash-phone" role="status" aria-label="Пуш собственнику на телефон">
      <div className="carwash-phone-frame">
        <span className="carwash-phone-notch" />
        <div className="carwash-phone-screen">
          <div className="carwash-phone-head">
            <span className="carwash-phone-app">ORIONIX</span>
            <span className="carwash-phone-now">сейчас</span>
          </div>
          <p className="carwash-phone-title">Проверьте мойку</p>
          <p className="carwash-phone-body">
            Бокс {box} · {clock} · {plate} — оплата не внесена
          </p>
        </div>
      </div>
    </div>
  );
}

function CarWashStaffTerminal({
  box,
  clock,
  plate,
  service,
}: {
  box: number;
  clock: string;
  plate: string;
  service: CarWashService;
}) {
  const [taken, setTaken] = useState(false);
  const [peek, setPeek] = useState(false);
  return (
    <div className="carwash-terminal" role="status" aria-label="Терминал службы контроля">
      <div className="carwash-terminal-head">
        <span className="carwash-terminal-dot" aria-hidden />
        <span className="carwash-terminal-app">Служба контроля</span>
        <span className="carwash-terminal-clock">{clock}</span>
      </div>
      <p className="carwash-terminal-title">
        <ExclamationTriangleIcon aria-hidden />
        Расхождение услуги
      </p>
      <p className="carwash-terminal-sub">
        Бокс {box} · {plate} · визит закрыт
      </p>
      <div className="carwash-terminal-grid">
        <div className="carwash-terminal-col">
          <span className="carwash-terminal-cap">В заказе</span>
          <span className="carwash-terminal-service">{service.ordered}</span>
          <span className="carwash-terminal-num">
            {service.orderedMinutes} мин · {sum(service.orderedPrice)}
          </span>
        </div>
        <div className="carwash-terminal-col" data-state="fact">
          <span className="carwash-terminal-cap">По факту</span>
          <span className="carwash-terminal-service">{service.performed}</span>
          <span className="carwash-terminal-num">
            {service.performedMinutes} мин · {sum(service.performedPrice)}
          </span>
        </div>
      </div>
      <p className="carwash-terminal-delta">
        −{service.orderedMinutes - service.performedMinutes} мин · −
        {sum(service.orderedPrice - service.performedPrice)} · вероятная кража услуги
      </p>
      <div className="carwash-terminal-actions">
        <button
          className="carwash-terminal-btn"
          data-state={taken ? 'taken' : 'live'}
          disabled={taken}
          onClick={() => setTaken(true)}
          type="button"
        >
          {taken ? 'В работе' : 'Принять в работу'}
        </button>
        <button
          aria-expanded={peek}
          className="carwash-terminal-btn"
          data-variant="ghost"
          onClick={() => setPeek((value) => !value)}
          type="button"
        >
          {peek ? 'Скрыть экран' : 'Что видит сотрудник'}
        </button>
      </div>
      {peek ? (
        <p className="carwash-terminal-peek">
          <span className="carwash-terminal-cap">Экран сотрудника</span>
          <span className="carwash-terminal-line">
            {service.performed} · {service.performedMinutes} мин · {sum(service.performedPrice)} · визит
            закрыт
          </span>
          <span className="carwash-terminal-ok">Ошибок нет</span>
        </p>
      ) : null}
    </div>
  );
}

function CarWashNotification({ event }: { event: ReturnType<typeof carwashLoop> }) {
  const [current, setCurrent] = useState(event);
  const [leaving, setLeaving] = useState<typeof event | null>(null);
  if (current.key !== event.key) {
    setLeaving(current);
    setCurrent(event);
  }
  return (
    <>
      {[leaving, current]
        .filter((item) => item !== null)
        .map((item) => (
          <div
            className="carwash-event"
            data-tone={item.tone}
            data-leaving={item.key !== current.key}
            aria-hidden={item.key !== current.key ? true : undefined}
            key={item.key}
            onAnimationEnd={(e) => {
              if (e.target === e.currentTarget && item.key !== current.key) setLeaving(null);
            }}
          >
            <span className="carwash-event-icon" aria-hidden>
              {item.tone === 'success' ? (
                <CheckIcon />
              ) : item.tone === 'progress' ? (
                <ArrowPathIcon />
              ) : item.tone === 'warning' ? (
                <ExclamationTriangleIcon />
              ) : (
                <CameraIcon />
              )}
            </span>
            <div>
              <span className="carwash-event-title">{item.title}</span>
              <span className="carwash-event-detail">{item.detail}</span>
            </div>
          </div>
        ))}
    </>
  );
}
