// @vitest-environment jsdom
/**
 * Копия теста модального окна из основного репо, адаптированная под песочницу:
 * там демо открывает витрина отраслей (IndustryShowcase), здесь — обвязка
 * SandboxPage. Проверки самого окна те же самые — держите их зелёными.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import ru from '../src/i18n/messages/ru.json' with { type: 'json' };
import { VISIT_SECONDS } from '../src/lib/carwash-loop';

vi.mock('next/dynamic', () => ({
  default:
    () =>
    ({ onReady }: { onReady?: () => void }) => (
      <button data-testid="demo-scene" onClick={onReady}>
        Scene ready
      </button>
    ),
}));
import SandboxPage from '../src/components/SandboxPage.js';

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});
function openCarWash() {
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  render(
    <NextIntlClientProvider locale="ru" messages={ru}>
      <SandboxPage />
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: /Открыть демо автомойки/ }));
  return screen.getByRole('dialog');
}

describe('continuous carwash demonstration', () => {
  it('opens one dialog with the carwash title', () => {
    const dialog = openCarWash();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(dialog.getAttribute('aria-labelledby')).toBe('carwash-dialog-title');
  });
  it('replaces manual controls and intro with business explanation, preserving standard steps', () => {
    const dialog = openCarWash();
    expect(within(dialog).queryByRole('slider')).toBeNull();
    expect(within(dialog).queryByRole('combobox')).toBeNull();
    expect(within(dialog).queryByText('Доска боксов')).toBeNull();
    expect(within(dialog).queryByRole('button', { name: /Запустить/ })).toBeNull();
    expect(within(dialog).getByText('Контроль для вашего автобизнеса')).toBeTruthy();
    expect(within(dialog).getByText('Автосервисы')).toBeTruthy();
    expect(within(dialog).getByText('Детейлинг')).toBeTruthy();
    expect(within(dialog).getByLabelText('Этапы визита машины')).toBeTruthy();
    expect(within(dialog).getAllByText(/Иллюстративная симуляция/)).toHaveLength(1);
  });
  it('starts when the scene is ready, advances without clicks and loops through every bay', () => {
    vi.useFakeTimers();
    const dialog = openCarWash();
    const live = within(dialog).getByRole('status', {
      name: 'События автомойки',
    });
    act(() => vi.advanceTimersByTime(10_000));
    expect(live.textContent).toBe('');
    fireEvent.click(within(dialog).getByTestId('demo-scene'));
    expect(live.textContent).toContain('Машина заезжает');
    act(() => vi.advanceTimersByTime(4_800));
    expect(live.textContent).toContain('Номер распознан');
    expect(live.textContent).toContain('Бокс 2');
    act(() => vi.advanceTimersByTime(VISIT_SECONDS * 1000));
    expect(live.textContent).toContain('Бокс 1');
    act(() => vi.advanceTimersByTime(VISIT_SECONDS * 1000));
    expect(live.textContent).toContain('Бокс 3');
    act(() => vi.advanceTimersByTime(VISIT_SECONDS * 1000));
    expect(live.textContent).toContain('Бокс 2');
  });
  it('does not skip the visit while hidden and resets after close/reopen', () => {
    vi.useFakeTimers();
    const dialog = openCarWash();
    fireEvent.click(within(dialog).getByTestId('demo-scene'));
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    act(() => vi.advanceTimersByTime(120_000));
    expect(
      within(dialog).getByRole('status', { name: 'События автомойки' }).textContent,
    ).toContain('Машина заезжает');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Закрыть демонстрацию' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => vi.advanceTimersByTime(120_000));
    fireEvent.click(screen.getByRole('button', { name: /Открыть демо автомойки/ }));
    const reopened = screen.getByRole('dialog');
    fireEvent.click(within(reopened).getByTestId('demo-scene'));
    expect(
      within(reopened).getByRole('status', { name: 'События автомойки' }).textContent,
    ).toContain('Бокс 2');
  });
});
