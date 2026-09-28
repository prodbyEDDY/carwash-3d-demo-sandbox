import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { ArrowPathIcon } from "@heroicons/react/24/outline"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // rounded-full — требование пользователя: кнопки pill во всех вариантах и размерах.
  // Список свойств вместо `transition-all` (канон анимаций §4.1): у кнопки
  // меняются ровно цвет/фон/рамка (hover), кольцо фокуса (box-shadow),
  // прозрачность (disabled) и масштаб (`button:active` из globals.css). `all`
  // тянул бы в переход ещё и ширину с отступами — они меняются при подстановке
  // спиннера `pending` и при смене size, и это layout, а не compositor.
  // Длительность и кривая не приписаны: дефолт всех `transition-*` посажен на
  // --motion-instant + --ease-out-quint в @theme (globals.css).
  // `relative` — опора для слоя спиннера `pending` (см. ниже): он лежит
  // поверх подписи, а не встаёт перед ней в потоке.
  "relative inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow,opacity,transform] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:bg-destructive/60 dark:focus-visible:ring-destructive/40",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        // Циан в роли текста — только --color-primary-deep: `text-primary`
        // (#3ba6f1) даёт 2.65:1 на карточке и не проходит AA (W6c P2-3).
        link: "text-[var(--color-primary-deep)] underline-offset-4 hover:underline",
      },
      // Двойной `has-`: `>svg` покрывает режим `asChild` (там содержимое
      // остаётся как есть), `>span>svg` — обычный режим, где подпись всегда
      // завёрнута в слот `button-label`. Без второго селектора любая
      // иконочная кнопка получила бы отступ текстовой, то есть стала шире.
      // Слой спиннера завёрнут в `<i>` намеренно — иначе он тоже совпадал бы
      // с `>span>svg`, и текстовая кнопка сужалась бы на время работы.
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3 has-[>span>svg]:px-3",
        xs: "h-6 gap-1 px-2 text-xs has-[>svg]:px-1.5 has-[>span>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5 has-[>span>svg]:px-2.5",
        lg: "h-10 px-6 has-[>svg]:px-4 has-[>span>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  pending = false,
  disabled,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /**
     * Замена HeroUI-шного `isPending`: блокирует кнопку, помечает её
     * `aria-busy` и подменяет подпись спиннером — без изменения ширины.
     */
    pending?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  // HeroUI ставил type="button" сам, у нативного <button> дефолт submit —
  // без этого кнопки внутри <form> отправляют форму (двойные срабатывания,
  // регресс пойман W1b). asChild не трогаем: там child может быть не <button>.
  const type = asChild ? props.type : (props.type ?? "button")

  // W8a (находка W8b). Спиннер вставлялся дополнительным flex-потомком перед
  // содержимым, и кнопка на время работы вырастала на иконку плюс gap — около
  // 24 px. Скачок ширины видели все ~20 мест вызова в кабинетах, а два из них
  // (OwnerClaimFlow, PasswordAuthForm) меняют ещё и текст подписи, то есть
  // давали скачок дважды. Канон требует cross-fade подписи на спиннер, а не
  // pop, и — молчаливое следствие — постоянной ширины.
  //
  // На время работы подпись уходит в собственный слот (`gap: inherit`
  // сохраняет шаг между иконкой и текстом, заданный размером кнопки), а
  // спиннер лежит поверх неё абсолютным слоем и в поток не входит. Ширина
  // кнопки перестаёт зависеть от `pending` вовсе — включая отступ иконочной
  // кнопки: слот подписи учтён вторым селектором `has-`, а слой спиннера
  // намеренно `<i>`, чтобы под этот селектор не попасть. Вне `pending` разметка
  // остаётся ровно прежней — обёртки нет. Перекрёстное затухание держится на `@starting-style`
  // (`starting:`): слои монтируются в момент включения `pending`, и без
  // стартового кадра подмена была бы мгновенной. Где `@starting-style` не
  // поддержан, слои просто встают в конечное состояние — как раньше, но уже
  // без скачка ширины.
  //
  // Подпись остаётся в дереве доступности (только прозрачная), иначе кнопка на
  // время работы теряла бы имя; о самой работе сообщает `aria-busy`.
  //
  // Slot.Root требует ровно один дочерний элемент, поэтому в режиме `asChild`
  // содержимое не оборачивается вовсе.
  const content =
    pending && !asChild ? (
      <>
        <span
          data-slot="button-label"
          className="inline-flex min-w-0 items-center gap-[inherit] opacity-0 transition-opacity duration-(--motion-instant) ease-(--ease-out-quint) starting:opacity-100"
        >
          {children}
        </span>
        <i
          data-slot="button-spinner"
          aria-hidden="true"
          className="absolute inset-0 grid place-items-center transition-opacity duration-(--motion-instant) ease-(--ease-out-quint) starting:opacity-0"
        >
          <ArrowPathIcon className="animate-spin" />
        </i>
      </>
    ) : (
      children
    )

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-pending={pending ? "true" : undefined}
      aria-busy={pending || undefined}
      disabled={disabled || pending || undefined}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
      type={type}
    >
      {content}
    </Comp>
  )
}

export { Button, buttonVariants }
