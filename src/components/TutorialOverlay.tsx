import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Cloud,
  KeyRound,
  Smartphone,
  Truck,
  WifiOff,
  Wrench,
  X,
} from 'lucide-react'
import type { AppView } from '../types'
import { cn } from '../lib/utils'

interface TutorialStep {
  title: string
  body: string
  tips: string[]
  icon: typeof Truck
  view?: AppView
}

const DESKTOP_STEPS: TutorialStep[] = [
  {
    title: 'Welcome to TruckTap',
    body: 'This quick tour shows the three daily views and the optional Team Sync layer. Your data stays on this device unless you turn on Team Sync.',
    tips: [
      'Tap used parts from the Tech tab.',
      'The Shop tab turns taps into a pick-list.',
      'Templates hold each van’s parts and par levels.',
    ],
    icon: Truck,
  },
  {
    title: 'Tech Clicker',
    body: 'Pick the van, then tap a part each time it is used. Counts save instantly, even with no signal.',
    tips: [
      'Use +1 for a used part and -1 to correct a tap.',
      'Hold the tile to undo the last change.',
      'Search or filter by category when the list is long.',
    ],
    icon: Wrench,
    view: 'tech',
  },
  {
    title: 'Shop Pick-List',
    body: 'The shop sees every pending line across vans. Pick each item, then export the supplier order as CSV.',
    tips: [
      'Check off lines as they are pulled.',
      'Mark the van restocked when it is loaded.',
      'Export the consolidated order for purchasing.',
    ],
    icon: ClipboardList,
    view: 'shop',
  },
  {
    title: 'Van Templates',
    body: 'Manage creates and edits vans, parts, categories, par levels, and starter trade lists.',
    tips: [
      'Load an Electrical, Plumbing, or Multifamily template.',
      'Edit names, SKUs, and par levels at any time.',
      'Clear usage counts after a restock.',
    ],
    icon: Boxes,
    view: 'manage',
  },
  {
    title: 'Team Sync and offline',
    body: 'Taps always save locally first. With Team Sync on, queued changes push to the cloud and other signed-in devices pull the merged board.',
    tips: [
      'Two +1 taps on the same part merge to +2.',
      'No Wi-Fi is required between devices, only internet.',
      'The status pill shows Local, Synced, Offline, or queued changes.',
    ],
    icon: Cloud,
    view: 'team',
  },
  {
    title: 'License and trial',
    body: 'The License tab shows the trial countdown, activates a TAP key, and links to downloads and support.',
    tips: [
      'The free trial is 30 days.',
      'Keys are verified offline on this device.',
      'Open this tour again from the help button in the header.',
    ],
    icon: KeyRound,
    view: 'license',
  },
]

const MOBILE_STEPS: TutorialStep[] = [
  {
    title: 'Welcome to TruckTap Mobile',
    body: 'Join your shop once with the join code, your name, and a 4–6 digit PIN. The shop’s vans and parts come down automatically.',
    tips: [
      'Get the join code from the shop desktop under Team Sync.',
      'Sign in later with the same code, name, and PIN.',
      'Your phone keeps working offline.',
    ],
    icon: Smartphone,
  },
  {
    title: 'Tap used parts',
    body: 'Open Tech, choose the van, and tap a part each time it is used. Every tap is saved on the phone immediately.',
    tips: [
      'Use +1 to add and -1 to correct a tap.',
      'Hold a tile to undo.',
      'Offline taps queue until the phone reconnects.',
    ],
    icon: Wrench,
    view: 'tech',
  },
  {
    title: 'Shop pick-list',
    body: 'The Shop tab shows pending lines. Pick items as they are pulled and mark the van restocked when it is loaded.',
    tips: [
      'The shop sees the same pick-list on its devices.',
      'Team Sync updates across different networks.',
      'CSV export is available on the shop/desktop side.',
    ],
    icon: ClipboardList,
    view: 'shop',
  },
  {
    title: 'Offline-first',
    body: 'No signal is not a problem. Taps queue locally, then push when the phone gets internet. Other devices pull the merged board.',
    tips: [
      'The header shows Online, Offline, or queued changes.',
      'Do not sign out while you still have unsynced taps.',
      'Your local copy stays on the phone if you disconnect.',
    ],
    icon: WifiOff,
    view: 'tech',
  },
  {
    title: 'Team Sync',
    body: 'Team Sync is the $39/month add-on that shares one board across phones, tablets, and the desktop. The shop owner manages members and roles.',
    tips: [
      'Techs tap and submit restock lists.',
      'Shop members work the pick-list.',
      'Signing out stops sync but keeps the local copy.',
    ],
    icon: Cloud,
    view: 'team',
  },
]

export function TutorialOverlay({
  open,
  mobile,
  onClose,
  onNavigate,
}: {
  open: boolean
  mobile: boolean
  onClose: () => void
  onNavigate: (view: AppView) => void
}) {
  const [index, setIndex] = useState(0)
  const steps = mobile ? MOBILE_STEPS : DESKTOP_STEPS

  if (!open) return null

  const step = steps[index]
  const last = index === steps.length - 1
  const Icon = step.icon

  const go = (next: number) => {
    const target = steps[next]
    if (target?.view) onNavigate(target.view)
    setIndex(next)
  }

  const finish = () => {
    setIndex(0)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/70 p-3 backdrop-blur-sm sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="tutorial-title"
        className="w-full max-w-md overflow-hidden rounded-3xl border border-line bg-panel text-ink shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-line bg-page/60 px-4 py-3">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">
            Quick tour · {index + 1} of {steps.length}
          </p>
          <button
            type="button"
            onClick={finish}
            aria-label="Close tutorial"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-panel-2 hover:text-ink"
          >
            <X size={19} />
          </button>
        </div>

        <div className="px-5 py-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-ink shadow-lg">
            <Icon size={28} />
          </div>
          <h2 id="tutorial-title" className="mt-4 text-2xl font-black tracking-tight">
            {step.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>

          <ul className="mt-4 space-y-2">
            {step.tips.map((tip) => (
              <li
                key={tip}
                className="flex items-start gap-2 rounded-xl border border-line bg-page/60 px-3 py-2 text-xs font-semibold leading-relaxed text-ink"
              >
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-success" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex gap-1.5">
            {steps.map((item, itemIndex) => (
              <button
                key={item.title}
                type="button"
                onClick={() => go(itemIndex)}
                aria-label={`Go to step ${itemIndex + 1}`}
                className={cn(
                  'h-1.5 flex-1 rounded-full transition',
                  itemIndex <= index ? 'bg-accent' : 'bg-line',
                )}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-line bg-page/60 px-4 py-3">
          <button
            type="button"
            onClick={finish}
            className="min-h-11 rounded-xl px-3 text-xs font-black text-muted hover:text-ink"
          >
            Skip
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => go(index - 1)}
              className="flex min-h-11 items-center gap-1.5 rounded-xl border border-line bg-panel px-3 text-xs font-black text-ink disabled:opacity-40"
            >
              <ArrowLeft size={15} /> Back
            </button>
            <button
              type="button"
              onClick={() => (last ? finish() : go(index + 1))}
              className="flex min-h-11 items-center gap-1.5 rounded-xl bg-accent px-4 text-xs font-black uppercase tracking-wide text-accent-ink"
            >
              {last ? 'Finish' : 'Next'}
              {!last && <ArrowRight size={15} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
