'use client';

import { EyeIcon, QuestionMarkCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useState, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

import type { IndustryPhase, IndustryZone } from '../../lib/industry-demo';

/** Четыре этапа реакции (тот же состав, что DEMO_PROCESS_PHASES, но узким
    типом — подписи этапов приходят ровно этим набором ключей). */
const PROCESS = ['detecting', 'evaluating', 'correcting', 'verifying'] as const;

/**
 * Общий UI модалок отраслевых 3D-демо (второй реворк по фидбэку владельца:
 * «крупная модалка, а не окно на весь экран; шапку убрать; статусы карточками
 * со змейкой как в how-секции; сценарии выпадающим списком; толстые бары»).
 *
 * Одна библиотека на пять сцен. Что снято этим реворком против прежней панели:
 *  · шапка окна целиком — заголовок остаётся только для читалок (sr-only),
 *    «Общий вид» стал глазиком поверх сцены, «Как это работает» убран;
 *  · бейдж фазы, плашка «Синтетические данные» и строка-подпись ноды —
 *    состояние читается по тексту сообщения и цвету карточек этапов,
 *    честность несёт один дисклеймер внизу панели;
 *  · равные строки сценариев — теперь компактный выпадающий список
 *    с кнопкой запуска справа;
 *  · подсказка управления сценой — из постоянной плашки в круглую кнопку
 *    с вопросиком (текст раскрывается по клику).
 *
 * Все подписи приходят пропами: у каждой сцены свой i18n-namespace.
 */

/** Круглая кнопка поверх 3D-сцены: полупрозрачный док, как у прежней плашки. */
const SCENE_BUTTON = 'rounded-full border-border bg-card/85 text-foreground shadow-sm backdrop-blur-md hover:bg-card';

export interface DemoSceneActionsProps {
  resetViewLabel: string;
  closeLabel: string;
  onResetView: () => void;
  onClose: () => void;
}

/** Замена шапки окна: «Общий вид» глазиком и крестик в правом верхнем углу сцены. */
export function DemoSceneActions({ resetViewLabel, closeLabel, onResetView, onClose }: DemoSceneActionsProps) {
  return (
    <div className="absolute right-4 top-4 z-10 flex gap-2">
      <Button
        size="icon"
        variant="outline"
        className={SCENE_BUTTON}
        aria-label={resetViewLabel}
        title={resetViewLabel}
        onClick={onResetView}
      >
        <EyeIcon className="size-5" aria-hidden />
      </Button>
      <Button
        size="icon"
        variant="outline"
        className={SCENE_BUTTON}
        aria-label={closeLabel}
        title={closeLabel}
        onClick={onClose}
      >
        <XMarkIcon className="size-5" aria-hidden />
      </Button>
    </div>
  );
}

export interface DemoSceneHelpProps {
  label: string;
  text: ReactNode;
}

/** Кнопка-вопросик в правом нижнем углу сцены: подсказка управления по клику. */
export function DemoSceneHelp({ label, text }: DemoSceneHelpProps) {
  // Radix-портал по умолчанию уезжает в <body> — под top-layer нативного
  // <dialog> его не видно; контейнером служит сам элемент диалога.
  const [container, setContainer] = useState<HTMLElement | null>(null);
  return (
    <div className="absolute bottom-4 right-4 z-10" ref={(el) => setContainer(el?.closest('dialog') ?? null)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button size="icon" variant="outline" className={SCENE_BUTTON} aria-label={label} title={label}>
            <QuestionMarkCircleIcon className="size-5" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          container={container}
          side="top"
          align="end"
          sideOffset={10}
          className="w-72 text-sm leading-relaxed text-muted-foreground"
        >
          {text}
        </PopoverContent>
      </Popover>
    </div>
  );
}

/** Правая колонка окна: прокручиваемый столбец карточек + дисклеймер честности. */
export function DemoPanel({ disclaimer, children }: { disclaimer: string; children: ReactNode }) {
  return (
    <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto border-l border-border bg-background p-4">
      {children}
      <p className="mt-auto pt-1 text-xs leading-relaxed text-muted-foreground">{disclaimer}</p>
    </aside>
  );
}

export interface DemoStatusCardProps {
  phase: IndustryPhase;
  /** Подписи всех четырёх этапов реакции. */
  processLabels: Record<(typeof PROCESS)[number], string>;
  processLabel: string;
  message: string;
}

/** Раскладка «змейкой» 2×2: 1 → 2 в верхнем ряду, вниз к 3, влево к 4 (под первым). */
const STEP_PLACEMENT = ['', '', 'col-start-2 row-start-2', 'col-start-1 row-start-2'] as const;
/** Чередующийся наклон — эхо карточек how-секции лендинга. */
const STEP_TILT = ['-rotate-2', 'rotate-2', '-rotate-2', 'rotate-2'] as const;

/**
 * Карточка состояния: живое сообщение и четыре этапа реакции карточками,
 * соединёнными пунктирной нитью (тот же приём, что в секции «Как проходит
 * проверка»: путь через центры ячеек, видны только отрезки в зазорах сетки).
 * Текущий этап подсвечивается цветом всей карточки — бейджи и подписи ноды
 * сняты, состояние несут текст и цвет.
 */
export function DemoStatusCard({ phase, processLabels, processLabel, message }: DemoStatusCardProps) {
  const currentIndex = PROCESS.indexOf(phase as (typeof PROCESS)[number]);
  return (
    <Card className="gap-0 py-0">
      <CardContent className="grid gap-4 p-4" aria-live="polite">
        {/* Высота зарезервирована: сообщение меняется по шагам сценария, и
            карточки ниже не должны прыгать. */}
        <p className="min-h-10 text-sm text-muted-foreground" key={message}>{message}</p>
        <div className="relative">
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M 25 25 H 75 V 75 H 25"
              stroke="var(--color-primary)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeDasharray="6 5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <ol className="relative grid grid-cols-2 gap-3" aria-label={processLabel}>
            {PROCESS.map((item, index) => {
              const attention = phase === 'requires-attention' && index === PROCESS.length - 1;
              const complete = phase === 'recovered'
                || (phase === 'requires-attention' ? index < PROCESS.length - 1 : index < currentIndex);
              const state = item === phase ? 'current' : attention ? 'attention' : complete ? 'complete' : 'idle';
              const inverted = state === 'current' || state === 'attention';
              return (
                // Непрозрачная подложка <li> прячет нить под карточкой:
                // сами тона этапов полупрозрачные.
                <li className={cn('rounded-2xl bg-background', STEP_PLACEMENT[index])} data-state={state} key={item}>
                  <div
                    className={cn(
                      'grid h-full content-center gap-0.5 rounded-2xl border border-border bg-card px-3 py-2.5 text-center transition-colors',
                      STEP_TILT[index],
                      state === 'complete' && 'border-success bg-success/10',
                      state === 'current' && 'border-primary bg-primary',
                      state === 'attention' && 'border-destructive bg-destructive',
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'font-display text-xs tabular-nums text-muted-foreground',
                        state === 'complete' && 'text-success',
                        inverted && 'text-primary-foreground/80',
                      )}
                    >
                      0{index + 1}
                    </span>
                    <span
                      className={cn(
                        'text-xs leading-tight text-muted-foreground',
                        state === 'complete' && 'text-success',
                        inverted && 'text-primary-foreground',
                      )}
                    >
                      {processLabels[item]}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}

export interface DemoScenarioOption {
  key: string;
  title: string;
}

export interface DemoScenariosProps {
  title: string;
  runLabel: string;
  resetLabel: string;
  /** Сценарий, запущенный извне (интро-тур) — синхронизирует выбор списка. */
  active: string | null;
  items: DemoScenarioOption[];
  onRun: (key: string) => void;
  onReset: () => void;
}

/** Сценарии — компактный выпадающий список с кнопкой запуска справа. */
export function DemoScenarios({ title, runLabel, resetLabel, active, items, onRun, onReset }: DemoScenariosProps) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [selected, setSelected] = useState(items[0]?.key ?? '');
  // Запуск извне (интро-тур) отражается в списке, ручной сброс — нет.
  const [lastActive, setLastActive] = useState(active);
  if (active !== lastActive) {
    setLastActive(active);
    if (active !== null && items.some((item) => item.key === active)) setSelected(active);
  }
  return (
    <Card className="gap-0 py-0">
      <CardContent className="grid gap-2.5 p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm text-foreground">{title}</h3>
          <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={onReset}>
            {resetLabel}
          </Button>
        </div>
        <div className="flex items-center gap-2" ref={(el) => setContainer(el?.closest('dialog') ?? null)}>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="min-w-0 flex-1" aria-label={title}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent container={container} position="popper">
              {items.map((item) => (
                <SelectItem key={item.key} value={item.key}>{item.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="shrink-0" onClick={() => { if (selected) onRun(selected); }}>
            {runLabel}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Карточка ручных параметров. */
export function DemoControls({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="grid gap-3 p-4">
        <h3 className="text-sm text-foreground">{title}</h3>
        <div className="grid gap-3">{children}</div>
      </CardContent>
    </Card>
  );
}

export interface DemoControlRowProps {
  label: string;
  /** Уже отформатированное значение. */
  valueText: string;
  unit: string;
  zone: IndustryZone;
  /** Подпись «Node корректирует значение», пока правит система. */
  systemLabel: string | null;
  /** Сам `<input type="range">` — логика и градиент зоны остаются у сцены. */
  children: ReactNode;
}

/**
 * Строка параметра: подпись + значение цветом зоны, ниже — толстый бар-ползунок
 * (`.industry-range` в globals.css). Зона остаётся в цвете значения и в
 * aria-valuetext самого ползунка.
 */
export function DemoControlRow({ label, valueText, unit, zone, systemLabel, children }: DemoControlRowProps) {
  return (
    <div className="industry-control-row grid gap-1" data-zone={zone}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-foreground">{label}</span>
        <output className="industry-control-value text-sm tabular-nums">
          {valueText}
          <small className="ml-1 text-xs text-muted-foreground">{unit}</small>
        </output>
      </div>
      {children}
      {systemLabel !== null && <em className="text-xs not-italic text-primary">{systemLabel}</em>}
    </div>
  );
}
