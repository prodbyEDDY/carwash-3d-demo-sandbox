import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * Размеры шрифта темы (`--text-*` в globals.css). Без этого tailwind-merge
 * принимает `text-heading` за цвет текста и выкидывает его рядом с
 * `text-muted-foreground` — типографика молча ломалась.
 */
const THEME_TEXT_SIZES = ['display', 'heading', 'subheading', 'body-lg', 'caption'] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: [...THEME_TEXT_SIZES] }],
    },
  },
});

/** Слияние Tailwind-классов: clsx собирает условные, tailwind-merge снимает конфликты. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
