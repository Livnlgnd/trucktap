import { CheckCircle2, ShieldCheck, Truck } from 'lucide-react'
import { VanSetupForm } from './VanSetupForm'
import type { ToastTone } from './Toast'
import type { Van } from '../types'

export function FirstRunView({
  onCreated,
  onToast,
}: {
  onCreated: (van: Van) => void
  onToast: (message: string, tone?: ToastTone) => void
}) {
  return (
    <div className="min-h-screen bg-page px-4 py-10 text-ink">
      <div className="mx-auto w-full max-w-2xl">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-accent-ink shadow-lg">
            <Truck size={32} />
          </div>
          <p className="mt-5 text-[10px] font-black uppercase tracking-[0.2em] text-accent">
            Welcome to TruckTap
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            Let's set up your first van.
          </h1>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted">
            Name your van and pick a starting parts list. You can change
            everything later, and your data stays on this device.
          </p>
        </div>

        <div className="mt-6 rounded-3xl border border-line bg-panel p-5 shadow-xl sm:p-7">
          <VanSetupForm
            submitLabel="Create my first van"
            onCreated={(van) => {
              onToast(`${van.name} is ready. Tap a part to start.`, 'success')
              onCreated(van)
            }}
          />
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          {[
            ['Works offline', 'Taps save on this device immediately.'],
            ['One board, two views', 'Techs tap. The shop gets a pick-list.'],
            ['No account needed', 'Team Sync is optional when you want it.'],
          ].map(([title, copy]) => (
            <div
              key={title}
              className="rounded-xl border border-line bg-panel/70 p-3"
            >
              <p className="flex items-center gap-1.5 text-xs font-black">
                <CheckCircle2 size={14} className="text-success" />
                {title}
              </p>
              <p className="mt-1 text-[10px] leading-relaxed text-muted">{copy}</p>
            </div>
          ))}
        </div>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-[10px] font-semibold text-muted">
          <ShieldCheck size={13} className="text-success" />
          Your van data is stored locally on this device.
        </p>
      </div>
    </div>
  )
}
