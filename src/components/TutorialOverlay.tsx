import { useEffect, useState } from 'react'
import { CheckCircle2, Sparkles, X } from 'lucide-react'

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

const STEP_TARGETS: Record<number, string> = {
  1: '[data-tutorial="item"]',
  2: '[data-tutorial="stepper"]',
  3: '[data-tutorial="scan"]',
  4: '[data-tutorial="status"]',
}

const STEP_COPY: Record<
  number,
  { title: string; body: string; hint?: string }
> = {
  1: {
    title: 'Tap to log usage',
    body: 'Tap the highlighted part once. This is the real clicker control — it logs one used part.',
    hint: 'Tap the highlighted tile',
  },
  2: {
    title: 'Adjust the count',
    body: 'Use the −1 button to correct the count. The stepper updates the same item.',
    hint: 'Tap −1 on the highlighted tile',
  },
  3: {
    title: 'Scan to add or restock',
    body: 'Scanning fills in the item details and saves it locally. In this tutorial the scan result is simulated.',
    hint: 'Tap Scan Item',
  },
  4: {
    title: 'Saved locally, queued automatically',
    body: 'TruckTap saves first, then queues the change for Team Sync. No signal is required.',
    hint: 'Tap the status badge or Got it',
  },
  5: {
    title: 'You’re ready',
    body: 'The demo data will now be discarded. Your real vans and parts are untouched.',
  },
}

export function TutorialOverlay({
  step,
  onSkip,
  onFinish,
  onStatusAck,
}: {
  step: number
  onSkip: () => void
  onFinish: () => void
  onStatusAck: () => void
}) {
  const [rect, setRect] = useState<Rect | null>(null)
  const selector = STEP_TARGETS[step]
  const copy = STEP_COPY[step]

  useEffect(() => {
    if (!selector) {
      setRect(null)
      return
    }
    let frame = 0
    let scrolled = false

    const measure = () => {
      const element = document.querySelector(selector)
      if (!(element instanceof HTMLElement)) {
        setRect(null)
        return
      }
      if (!scrolled) {
        scrolled = true
        element.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
      const box = element.getBoundingClientRect()
      setRect({
        top: box.top,
        left: box.left,
        width: box.width,
        height: box.height,
      })
    }

    const tick = () => {
      measure()
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [selector])

  if (step === 5) {
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-3xl border border-line bg-panel p-6 text-center text-ink shadow-2xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent text-accent-ink shadow-lg">
            <Sparkles size={30} />
          </div>
          <p className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-accent">
            Step 5 of 5 · Complete
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight">{copy.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{copy.body}</p>
          <div className="mt-4 space-y-2 text-left">
            {[
              'Techs tap used parts from the Tech tab.',
              'The shop works the pick-list and exports orders.',
              'Team Sync shares one board across devices.',
            ].map((tip) => (
              <p
                key={tip}
                className="flex items-start gap-2 rounded-xl border border-line bg-page/60 px-3 py-2 text-xs font-semibold"
              >
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-success" />
                {tip}
              </p>
            ))}
          </div>
          <button
            type="button"
            onClick={onFinish}
            className="mt-5 min-h-16 w-full rounded-xl bg-accent px-4 text-sm font-black uppercase tracking-wide text-accent-ink"
          >
            Start Using TruckTap
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="mt-2 min-h-10 w-full text-xs font-bold text-muted hover:text-ink"
          >
            Skip tutorial
          </button>
        </div>
      </div>
    )
  }

  const padding = 8
  const tooltipBelow = rect ? rect.top < window.innerHeight * 0.48 : true
  const spaceBelow = rect ? window.innerHeight - (rect.top + rect.height) : 0
  const placement = rect
    ? tooltipBelow && spaceBelow > 230
      ? 'below'
      : 'above'
    : 'center'

  return (
    <div className="pointer-events-none fixed inset-0 z-[120]">
      {!rect ? (
        <div className="pointer-events-auto absolute inset-0 bg-slate-950/75 backdrop-blur-sm" />
      ) : (
        <>
          <div
            className="pointer-events-auto fixed left-0 right-0 top-0 bg-slate-950/72"
            style={{ height: Math.max(0, rect.top - padding) }}
          />
          <div
            className="pointer-events-auto fixed bottom-0 left-0 right-0 bg-slate-950/72"
            style={{ top: rect.top + rect.height + padding }}
          />
          <div
            className="pointer-events-auto fixed left-0 bg-slate-950/72"
            style={{
              top: Math.max(0, rect.top - padding),
              height: rect.height + padding * 2,
              width: Math.max(0, rect.left - padding),
            }}
          />
          <div
            className="pointer-events-auto fixed right-0 bg-slate-950/72"
            style={{
              top: Math.max(0, rect.top - padding),
              height: rect.height + padding * 2,
              left: rect.left + rect.width + padding,
            }}
          />
          <div
            className="pointer-events-none fixed rounded-2xl border-[3px] border-accent shadow-[0_0_0_5px_rgba(194,65,12,0.28),0_0_40px_rgba(194,65,12,0.45)]"
            style={{
              top: rect.top - 4,
              left: rect.left - 4,
              width: rect.width + 8,
              height: rect.height + 8,
            }}
          />
        </>
      )}

      <div
        className="pointer-events-auto fixed inset-x-3 z-[121] mx-auto max-w-md rounded-2xl border border-line bg-panel p-4 text-ink shadow-2xl sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2"
        style={
          placement === 'below'
            ? { top: (rect?.top ?? 0) + (rect?.height ?? 0) + 18 }
            : placement === 'above'
              ? {
                  bottom: window.innerHeight - (rect?.top ?? 0) + 18,
                }
              : { top: '30%' }
        }
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-ink">
            <Sparkles size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-accent">
              Step {step} of 5
            </p>
            <h2 className="mt-0.5 text-base font-black">{copy.title}</h2>
          </div>
          <button
            type="button"
            onClick={onSkip}
            aria-label="Skip tutorial"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-panel-2 hover:text-ink"
          >
            <X size={17} />
          </button>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">{copy.body}</p>
        {copy.hint && (
          <p className="mt-2 rounded-lg bg-accent/10 px-2.5 py-1.5 text-[10px] font-black uppercase tracking-wide text-accent">
            {copy.hint}
          </p>
        )}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onSkip}
            className="min-h-9 rounded-lg px-2 text-[10px] font-black uppercase tracking-wide text-muted hover:text-ink"
          >
            Skip Tutorial
          </button>
          {step === 4 && (
            <button
              type="button"
              onClick={onStatusAck}
              className="ml-auto min-h-10 rounded-lg bg-accent px-3 text-[10px] font-black uppercase tracking-wide text-accent-ink"
            >
              Got it
            </button>
          )}
          {step === 3 && (
            <span className="ml-auto text-[10px] font-semibold text-muted">
              Simulated scan
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
