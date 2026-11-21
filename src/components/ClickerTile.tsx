import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { Minus } from 'lucide-react'
import type { PartItem } from '../types'
import { getCategoryMeta } from '../lib/templates'
import { cn, haptic } from '../lib/utils'
import { PartIcon } from './PartIcon'

type FlashState = 'add' | 'remove' | null

export function ClickerTile({
  part,
  onIncrement,
  onDecrement,
}: {
  part: PartItem
  onIncrement: (partId: string) => void
  onDecrement: (partId: string) => void
}) {
  const [flash, setFlash] = useState<FlashState>(null)
  const flashTimer = useRef<number | null>(null)
  const longPressTimer = useRef<number | null>(null)
  const didLongPress = useRef(false)
  const category = getCategoryMeta(part.category)
  const isActive = part.currentUsedToday > 0

  useEffect(
    () => () => {
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current)
      if (longPressTimer.current !== null) {
        window.clearTimeout(longPressTimer.current)
      }
    },
    [],
  )

  const flashTile = (next: Exclude<FlashState, null>) => {
    if (flashTimer.current !== null) window.clearTimeout(flashTimer.current)
    setFlash(next)
    flashTimer.current = window.setTimeout(() => setFlash(null), 260)
  }

  const increment = () => {
    haptic(30)
    flashTile('add')
    onIncrement(part.id)
  }

  const decrement = () => {
    if (part.currentUsedToday <= 0) return
    haptic(45)
    flashTile('remove')
    onDecrement(part.id)
  }

  const clearLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return

    didLongPress.current = false
    clearLongPress()
    longPressTimer.current = window.setTimeout(() => {
      didLongPress.current = true
      decrement()
    }, 560)
  }

  const handleClick = () => {
    if (didLongPress.current) {
      didLongPress.current = false
      return
    }
    increment()
  }

  return (
    <article
      className={cn(
        'group relative flex min-h-[224px] flex-col overflow-hidden rounded-2xl border-2 p-3 text-left shadow-sm transition-[transform,border-color,background-color,box-shadow] duration-150 sm:min-h-[238px] sm:p-4',
        isActive
          ? 'border-emerald-600/70 bg-emerald-500/[0.055] dark:border-emerald-400/60'
          : 'border-line bg-panel',
        flash === 'add' &&
          'border-emerald-400 bg-emerald-100 ring-4 ring-emerald-400/25 dark:bg-emerald-950/40',
        flash === 'remove' &&
          'border-amber-400 bg-amber-100 ring-4 ring-amber-400/25 dark:bg-amber-950/40',
        'focus-within:ring-4 focus-within:ring-accent/30',
      )}
    >
      <button
        type="button"
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerUp={clearLongPress}
        onPointerCancel={clearLongPress}
        onPointerLeave={clearLongPress}
        onContextMenu={(event) => event.preventDefault()}
        aria-label={`Mark one ${part.name} used. Press and hold to undo.`}
        title="Tap +1 · Hold to undo"
        className="absolute inset-0 z-0 cursor-pointer touch-manipulation select-none rounded-2xl focus-visible:outline-none"
      />

      <div className="pointer-events-none relative z-10 flex items-start justify-between gap-2">
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl sm:h-14 sm:w-14',
            category.iconClass,
          )}
        >
          <PartIcon name={part.iconName} size={27} strokeWidth={2.1} />
        </div>

        {isActive && (
          <span className="animate-badge-in rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-black tracking-wide text-white shadow-md dark:bg-emerald-400 dark:text-emerald-950">
            USED: {part.currentUsedToday}
          </span>
        )}
      </div>

      <div className="pointer-events-none relative z-10 mt-3 flex-1">
        <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-muted sm:text-[10px]">
          <span className={cn('h-1.5 w-1.5 rounded-full', category.dotClass)} />
          <span className="truncate">{category.filterLabel}</span>
        </div>
        <h3 className="mt-1 line-clamp-3 min-h-[3.6em] text-[15px] font-extrabold leading-[1.18] tracking-tight text-ink sm:text-[17px]">
          {part.name}
        </h3>
        <p className="mt-2 truncate font-mono text-[10px] font-semibold uppercase tracking-wide text-muted">
          {part.sku?.trim() || 'NO SKU'} <span className="text-muted/60">·</span>{' '}
          PAR {part.parLevel}
        </p>
      </div>

      <div className="relative z-20 mt-3 flex items-end justify-between gap-2">
        <button
          type="button"
          onClick={decrement}
          disabled={!isActive}
          aria-label={`Remove one ${part.name} from today's used count`}
          className={cn(
            'pointer-events-auto flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border-2 font-black transition active:scale-95',
            isActive
              ? 'border-line bg-panel-2 text-ink hover:border-amber-500/60 hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-300'
              : 'cursor-not-allowed border-line/60 bg-panel-2/50 text-muted/35',
          )}
        >
          <span className="flex items-center gap-1 text-sm">
            <Minus size={18} strokeWidth={3} />
            1
          </span>
        </button>

        <span className="pointer-events-none pb-1 text-right text-[9px] font-black uppercase leading-tight tracking-[0.12em] text-muted/70 sm:text-[10px]">
          Tap +1
          <br />
          Hold undo
        </span>
      </div>
    </article>
  )
}
