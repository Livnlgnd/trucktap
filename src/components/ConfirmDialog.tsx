import { AlertTriangle, Trash2 } from 'lucide-react'
import { Modal } from './Modal'
import { cn } from '../lib/utils'

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  tone?: 'danger' | 'accent'
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title} size="sm">
      <div className="flex items-start gap-4">
        <div
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl',
            tone === 'danger'
              ? 'bg-red-500/10 text-red-600 dark:text-red-400'
              : 'bg-accent/10 text-accent',
          )}
        >
          {tone === 'danger' ? <Trash2 size={24} /> : <AlertTriangle size={24} />}
        </div>
        <p className="pt-1 text-sm leading-relaxed text-muted">{description}</p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="min-h-16 rounded-2xl border-2 border-line bg-panel px-4 text-sm font-bold text-ink transition hover:bg-panel-2 active:scale-[0.99] disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={cn(
            'min-h-16 rounded-2xl px-4 text-sm font-black text-white transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60',
            tone === 'danger' ? 'bg-red-600 hover:bg-red-500' : 'bg-accent',
          )}
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
