import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CheckCircle2,
  ClipboardList,
  LoaderCircle,
  Send,
  Truck,
  X,
} from 'lucide-react'
import type { PartItem } from '../types'
import { cn } from '../lib/utils'
import { PartIcon } from './PartIcon'

export function ConfirmSendDrawer({
  open,
  vanName,
  jobTag,
  usedParts,
  onClose,
  onConfirm,
}: {
  open: boolean
  vanName: string
  jobTag: string
  usedParts: PartItem[]
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const totalQty = usedParts.reduce(
    (sum, part) => sum + part.currentUsedToday,
    0,
  )

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [busy, onClose, open])

  if (!open) return null

  const confirm = async () => {
    if (busy) return
    setBusy(true)
    try {
      await onConfirm()
    } finally {
      setBusy(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="send-restock-title"
        className="animate-sheet-up flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border border-line bg-panel text-ink shadow-2xl sm:max-w-lg sm:animate-modal-in sm:rounded-3xl"
      >
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent">
            <ClipboardList size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="send-restock-title"
              className="text-xl font-black tracking-tight"
            >
              Send restock list?
            </h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
              <Truck size={15} />
              <span className="truncate">{vanName}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close confirmation"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-line bg-panel-2 text-muted transition hover:text-ink active:scale-95 disabled:opacity-50"
          >
            <X size={22} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-[11px] font-black uppercase tracking-[0.16em] text-muted">
              Tapped today
            </span>
            <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-black text-accent">
              {totalQty} {totalQty === 1 ? 'part' : 'parts'}
            </span>
          </div>

          <ul className="space-y-2">
            {usedParts.map((part) => (
              <li
                key={part.id}
                className="flex items-center gap-3 rounded-xl border border-line bg-page/60 p-2.5"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-panel-2 text-muted">
                  <PartIcon name={part.iconName} size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{part.name}</p>
                  <p className="truncate font-mono text-[10px] uppercase text-muted">
                    {part.sku || 'NO SKU'}
                  </p>
                </div>
                <span className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-lg bg-ink px-2 text-sm font-black text-page">
                  ×{part.currentUsedToday}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4 rounded-xl border border-line bg-page/60 p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted">
              Job / Unit #
            </p>
            <p className="mt-1 text-sm font-bold">
              {jobTag.trim() || 'No job tag attached'}
            </p>
          </div>

          <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" />
            Saved to this device immediately. The shop will see it in the
            pick-list, and a sync job is queued for when you have signal.
          </p>
        </div>

        <div className="safe-bottom border-t border-line bg-panel px-5 pt-4">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="font-bold text-muted">List total</span>
            <span className="font-black">
              {totalQty} {totalQty === 1 ? 'unit' : 'units'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={busy || usedParts.length === 0}
            className="flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 text-base font-black uppercase tracking-wide text-accent-ink shadow-lg transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? (
              <LoaderCircle size={22} className="animate-spin" />
            ) : (
              <Send size={21} />
            )}
            {busy ? 'Sending…' : 'Confirm & Send'}
          </button>
          <p
            className={cn(
              'pb-1 pt-2 text-center text-[10px] font-semibold text-muted',
              !jobTag.trim() && 'opacity-70',
            )}
          >
            Tap counts reset to zero after sending.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
