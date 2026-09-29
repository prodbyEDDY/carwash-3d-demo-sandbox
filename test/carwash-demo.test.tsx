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
    expect(within(dialog).getByRole('combobox', { name: 'Сценарии' })).toBeTruthy();
    expect(within(dialog).queryByText('Доска боксов')).toBeNull();
    expect(within(dialog).getByRole('button', { name: /Запустить/ })).toBeTruthy();
    expect(within(dialog).getByText('Контроль для вашего автобизнеса')).toBeTruthy();
    expect(within(dialog).getByText('Автосервисы')).toBeTruthy();
    expect(within(dialog).getByText('Детейлинг')).toBeTruthy();
    expect(within(dialog).getByLabelText('Этапы визита машины')).toBeTruthy();
    expect(within(dialog).getAllByText(/Иллюстративная симуляция/)).toHaveLength(1);
  });
  it('offers exactly the two scenarios that are implemented in 3D', () => {
    const dialog = openCarWash();
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Сценарии' }));
    const options = within(dialog).getAllByRole('option');
    expect(options.map((item) => item.textContent)).toEqual([
      'Обычный визит',
      'Приехала машина не из списка',
      'Оказана другая услуга',
    ]);
  });
  it('waits for Запустить, then plays the base scenario and loops through every bay', () => {
    vi.useFakeTimers();
    const dialog = openCarWash();
    const live = within(dialog).getByRole('status', {
      name: 'События автомойки',
    });
    fireEvent.click(within(dialog).getByTestId('demo-scene'));
    act(() => vi.advanceTimersByTime(10_000));
    expect(live.textContent).toBe('');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Запустить' }));
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
  it('Запустить rewinds the running scenario back to its first step', () => {
    vi.useFakeTimers();
    const dialog = openCarWash();
    const live = within(dialog).getByRole('status', { name: 'События автомойки' });
    fireEvent.click(within(dialog).getByTestId('demo-scene'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Запустить' }));
    act(() => vi.advanceTimersByTime(4_800));
    expect(live.textContent).toContain('Номер распознан');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Запустить' }));
    expect(live.textContent).toContain('Машина заезжает');
  });
  it('Сбросить returns the demo to the state before any scenario', () => {
    vi.useFakeTimers();
    const dialog = openCarWash();
    const live = within(dialog).getByRole('status', { name: 'События автомойки' });
    fireEvent.click(within(dialog).getByTestId('demo-scene'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Запустить' }));
    act(() => vi.advanceTimersByTime(4_800));
    expect(live.textContent).toContain('Номер распознан');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сбросить' }));
    expect(live.textContent).toBe('');
    expect(
      within(dialog).getByText(
        'Мойка работает в демонстрационном режиме. Node ведёт сессии боксов и сверяет их с журналом.',
      ),
    ).toBeTruthy();
    // Покой держится сам по себе: время идёт, но сценарий не запущен.
    act(() => vi.advanceTimersByTime(20_000));
    expect(live.textContent).toBe('');
  });
  it('does not skip the visit while hidden and resets after close/reopen', () => {    vi.useFakeTimers();
    const dialog = openCarWash();
    fireEvent.click(within(dialog).getByTestId('demo-scene'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Запустить' }));
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
    const live = within(reopened).getByRole('status', { name: 'События автомойки' });
    // Заново открытое демо снова ждёт запуска: часы сброшены вместе с состоянием.
    expect(live.textContent).toBe('');
    fireEvent.click(within(reopened).getByRole('button', { name: 'Запустить' }));
    expect(live.textContent).toContain('Бокс 2');
  });
  it('играет выбранный сценарий «машина не из списка» и показывает пуш собственнику', () => {
    vi.useFakeTimers();
    const dialog = openCarWash();
    fireEvent.click(within(dialog).getByTestId('demo-scene'));
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Сценарии' }));
    fireEvent.click(within(dialog).getByRole('option', { name: 'Приехала машина не из списка' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Запустить' }));
    const live = within(dialog).getByRole('status', { name: 'События автомойки' });
    // Начало визита общее с обычным сценарием.
    expect(live.textContent).toContain('Машина заезжает');
    act(() => vi.advanceTimersByTime(9_600));
    expect(live.textContent).toContain('В системе такого номера нет');
    act(() => vi.advanceTimersByTime(5_000));
    expect(live.textContent).toContain('Визит добавлен с предупреждением');
    act(() => vi.advanceTimersByTime(10_000));
    expect(live.textContent).toContain('Мойка в работе');
    // Пока оплата не внесена, собственнику уходит пуш.
    act(() => vi.advanceTimersByTime(11_000));
    expect(live.textContent).toContain('Оплата не внесена');
    const push = within(dialog).getByLabelText('Пуш собственнику на телефон');
    expect(push.textContent).toContain('Проверьте мойку');
    expect(push.textContent).toMatch(/Бокс \d · \d{2}:\d{2} · \d{3} [A-Z]{3} \d{2} — оплата не внесена/);
  });
  it('Сбросить гасит пуш и возвращает обычный визит', () => {
    vi.useFakeTimers();
    const dialog = openCarWash();
    fireEvent.click(within(dialog).getByTestId('demo-scene'));
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Сценарии' }));
    fireEvent.click(within(dialog).getByRole('option', { name: 'Приехала машина не из списка' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Запустить' }));
    act(() => vi.advanceTimersByTime(36_000));
    expect(within(dialog).queryByLabelText('Пуш собственнику на телефон')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сбросить' }));
    expect(within(dialog).queryByLabelText('Пуш собственнику на телефон')).toBeNull();
    expect(within(dialog).getByRole('status', { name: 'События автомойки' }).textContent).toBe('');
  });
  it('показывает терминал службы контроля, не выдавая ошибку сотруднику', () => {
    vi.useFakeTimers();
    const dialog = openCarWash();
    fireEvent.click(within(dialog).getByTestId('demo-scene'));
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Сценарии' }));
    fireEvent.click(within(dialog).getByRole('option', { name: 'Оказана другая услуга' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Запустить' }));
    const live = within(dialog).getByRole('status', { name: 'События автомойки' });
    act(() => vi.advanceTimersByTime(30_000));
    expect(within(dialog).queryByLabelText('Терминал службы контроля')).toBeNull();
    expect(live.textContent).toContain('Оплата прошла');
    act(() => vi.advanceTimersByTime(6_000));
    const terminal = within(dialog).getByLabelText('Терминал службы контроля');
    expect(terminal.textContent).toContain('Комплексная мойка');
    expect(terminal.textContent).toContain('Мойка кузова');
    expect(terminal.textContent).toContain('60 мин');
    expect(terminal.textContent).toContain('20 мин');
    expect(terminal.textContent).toContain('вероятная кража услуги');
    // Сотруднику и собственнику система ничего не сообщает: ни пуша, ни флага.
    expect(within(dialog).queryByLabelText('Пуш собственнику на телефон')).toBeNull();
    expect(live.textContent).toContain('Сигнал в службу контроля');
  });
  it('терминал принимает сигнал в работу и показывает, что видит сотрудник', () => {
    vi.useFakeTimers();
    const dialog = openCarWash();
    fireEvent.click(within(dialog).getByTestId('demo-scene'));
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Сценарии' }));
    fireEvent.click(within(dialog).getByRole('option', { name: 'Оказана другая услуга' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Запустить' }));
    act(() => vi.advanceTimersByTime(36_000));
    const terminal = within(dialog).getByLabelText('Терминал службы контроля');
    expect(within(terminal).queryByText('Ошибок нет')).toBeNull();
    fireEvent.click(within(terminal).getByRole('button', { name: 'Принять в работу' }));
    expect(within(terminal).getByRole('button', { name: 'В работе' })).toBeTruthy();
    fireEvent.click(within(terminal).getByRole('button', { name: 'Что видит сотрудник' }));
    expect(within(terminal).getByText('Ошибок нет')).toBeTruthy();
    expect(within(terminal).getByText(/Мойка кузова · 20 мин/)).toBeTruthy();
  });
  it('Сбросить убирает терминал', () => {
    vi.useFakeTimers();
    const dialog = openCarWash();
    fireEvent.click(within(dialog).getByTestId('demo-scene'));
    fireEvent.click(within(dialog).getByRole('combobox', { name: 'Сценарии' }));
    fireEvent.click(within(dialog).getByRole('option', { name: 'Оказана другая услуга' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Запустить' }));
    act(() => vi.advanceTimersByTime(36_000));
    expect(within(dialog).queryByLabelText('Терминал службы контроля')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Сбросить' }));
    expect(within(dialog).queryByLabelText('Терминал службы контроля')).toBeNull();
  });
});
