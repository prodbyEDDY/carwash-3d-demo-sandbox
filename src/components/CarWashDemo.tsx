'use client';

import dynamic from 'next/dynamic';
import { CheckIcon, CameraIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import {
  DemoPanel,
  DemoSceneActions,
  DemoSceneHelp,
  DemoStatusCard,
} from './industry/DemoPanelUi';
import { Card, CardContent } from './ui/card';
import { CARWASH_BASELINE } from '../lib/carwash-simulation';
import { carwashLoop } from '../lib/carwash-loop';

const CarWashScene = dynamic(() => import('./CarWashScene'), { ssr: false });

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
  const [frame, setFrame] = useState(() => carwashLoop(0));
  const [ready, setReady] = useState(false);
  const [resetViewToken, setResetViewToken] = useState(0);
  useEffect(() => {
    if (!ready) return;
    let last = performance.now();
    let key = '';
    const timer = window.setInterval(() => {
      const now = performance.now();
      if (!document.hidden) elapsed.current += (now - last) / 1000;
      last = now;
      const next = carwashLoop(elapsed.current);
      if (next.key !== key) {
        key = next.key;
        setFrame(next);
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
  }, [ready]);
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
              {ready && <CarWashNotification event={frame} />}
            </div>
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
