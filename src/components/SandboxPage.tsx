'use client';

import { useState } from 'react';

import CarWashDemo from './CarWashDemo';
import { Button } from './ui/button';

/**
 * Обвязка песочницы. В основном сайте демо открывает карточка «Автомойка» в
 * витрине отраслей (IndustryShowcase); здесь — одна кнопка. Этот файл в
 * основной репо не возвращается.
 */
export default function SandboxPage() {
  const [open, setOpen] = useState(false);
  return (
    <main className="min-h-dvh grid place-items-center p-6">
      <div className="grid gap-4 text-center">
        <h1 className="font-display text-heading">Песочница демо автомойки</h1>
        <p className="text-muted-foreground max-w-prose">
          Тот же компонент, что открывается с лендинга ornode.org. Модальное окно — CarWashDemo,
          сцена — CarWashScene, геометрия — components/carwash.
        </p>
        <div>
          <Button size="lg" onClick={() => setOpen(true)} aria-haspopup="dialog">
            Открыть демо автомойки
          </Button>
        </div>
      </div>
      <CarWashDemo open={open} onClose={() => setOpen(false)} />
    </main>
  );
}
