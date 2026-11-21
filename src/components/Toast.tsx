import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { cn } from '../lib/utils'

export type ToastTone = 'success' | 'error' | 'info'

export interface ToastData {
  id: number
  message: string
  tone: ToastTone
}

export function Toast({ toast }: { toast: ToastData | null }) {
  if (!toast) return null

  const Icon =
    toast.tone === 'success'
      ? CheckCircle2
      : toast.tone === 'error'
        ? XCircle
        : Info

  return (
    <div
      key={toast.id}
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 top-[calc(env(safe-area-inset-top)+9.5rem)] z-[80] flex justify-center sm:top-36"
    >
      <div
        className={cn(
          'animate-toast-in flex max-w-lg items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold shadow-xl backdrop-blur-md',
          toast.tone === 'success' &&
            'border-emerald-500/40 bg-emerald-950/95 text-emerald-50 dark:bg-emerald-900/95',
          toast.tone === 'error' &&
            'border-red-500/40 bg-red-950/95 text-red-50 dark:bg-red-950/95',
          toast.tone === 'info' &&
            'border-line bg-panel/95 text-ink dark:bg-panel/95',
        )}
      >
        <Icon size={20} className="shrink-0" />
        <span>{toast.message}</span>
      </div>
    </div>
  )
}
