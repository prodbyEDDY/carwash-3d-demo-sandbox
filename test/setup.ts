/**
 * Полифилы jsdom для примитивов Radix (Select, Tooltip, Popover, Slider,
 * DropdownMenu). jsdom не реализует ResizeObserver, Pointer Capture,
 * scrollIntoView и matchMedia — без них компоненты падают на маунте.
 *
 * Файл подключён глобально (vitest.config.ts → setupFiles), поэтому он
 * обязан быть безопасным в окружении node: без window ничего не трогаем.
 * Все определения ставятся только если их ещё нет — тест волен подменить
 * любую из них своим шпионом.
 */

if (typeof window !== 'undefined') {
  if (!('ResizeObserver' in window)) {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    Object.defineProperty(window, 'ResizeObserver', {
      writable: true,
      configurable: true,
      value: ResizeObserverStub,
    });
  }

  if (!('IntersectionObserver' in window)) {
    class IntersectionObserverStub {
      readonly root = null;
      readonly rootMargin = '';
      readonly thresholds: readonly number[] = [];
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
    Object.defineProperty(window, 'IntersectionObserver', {
      writable: true,
      configurable: true,
      value: IntersectionObserverStub,
    });
  }

  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }

  // jsdom не знает PointerEvent — Radix шлёт pointerdown/pointerup руками.
  if (!('PointerEvent' in window)) {
    // Именно глобальный MouseEvent: window внутри этой ветки TS сужает до never.
    class PointerEventStub extends MouseEvent {
      readonly pointerId: number;
      readonly pointerType: string;
      readonly isPrimary: boolean;
      constructor(type: string, params: PointerEventInit = {}) {
        super(type, params);
        this.pointerId = params.pointerId ?? 0;
        this.pointerType = params.pointerType ?? 'mouse';
        this.isPrimary = params.isPrimary ?? true;
      }
    }
    Object.defineProperty(window, 'PointerEvent', {
      writable: true,
      configurable: true,
      value: PointerEventStub,
    });
  }

  const element = window.Element.prototype as unknown as Record<string, unknown>;
  const stubs: Record<string, (...args: never[]) => unknown> = {
    hasPointerCapture: () => false,
    setPointerCapture: () => undefined,
    releasePointerCapture: () => undefined,
    scrollIntoView: () => undefined,
  };
  for (const [name, implementation] of Object.entries(stubs)) {
    if (typeof element[name] !== 'function') {
      Object.defineProperty(element, name, {
        writable: true,
        configurable: true,
        value: implementation,
      });
    }
  }
}
