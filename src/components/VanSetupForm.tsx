import { useState, type FormEvent } from 'react'
import { LoaderCircle, Package, Truck } from 'lucide-react'
import { createVan } from '../db'
import { TRADE_PRESETS } from '../lib/templates'
import { cn } from '../lib/utils'
import type { Van } from '../types'

const TEMPLATE_OPTIONS = [
  ...TRADE_PRESETS.map((preset) => ({
    id: preset.id,
    name: preset.name,
    description: preset.description,
    partCount: preset.parts.length,
  })),
  {
    id: 'empty',
    name: 'Start empty',
    description: 'Build the parts list yourself, one part at a time.',
    partCount: 0,
  },
]

export function VanSetupForm({
  submitLabel,
  onCreated,
}: {
  submitLabel: string
  onCreated: (van: Van) => void
}) {
  const [name, setName] = useState('')
  const [techName, setTechName] = useState('')
  const [presetId, setPresetId] = useState('electrical')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy) return

    const trimmed = name.trim()
    if (!trimmed) {
      setError('Give this van a name so your team can tell it apart.')
      return
    }

    setBusy(true)
    setError('')

    try {
      const preset = TRADE_PRESETS.find((option) => option.id === presetId)
      const van = await createVan({
        name: trimmed,
        techName,
        templateParts: preset?.parts ?? [],
        presetId: preset?.id ?? 'empty',
      })
      onCreated(van)
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'The van could not be created.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-muted">
            Van or truck name
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Van 12, Truck 7, Service truck"
            autoFocus
            className="min-h-14 w-full rounded-xl border-2 border-line bg-page px-3 text-sm font-semibold text-ink outline-none transition placeholder:font-normal placeholder:text-muted/60 focus:border-accent focus:ring-4 focus:ring-accent/15"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-muted">
            Technician <span className="font-semibold normal-case tracking-normal">(optional)</span>
          </span>
          <input
            value={techName}
            onChange={(event) => setTechName(event.target.value)}
            placeholder="Who drives it?"
            className="min-h-14 w-full rounded-xl border-2 border-line bg-page px-3 text-sm font-semibold text-ink outline-none transition placeholder:font-normal placeholder:text-muted/60 focus:border-accent focus:ring-4 focus:ring-accent/15"
          />
        </label>
      </div>

      <fieldset className="mt-5">
        <legend className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-muted">
          Starting parts list
        </legend>
        <div className="grid gap-2">
          {TEMPLATE_OPTIONS.map((option) => {
            const selected = presetId === option.id
            return (
              <label
                key={option.id}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition',
                  selected
                    ? 'border-accent bg-accent/10'
                    : 'border-line bg-page hover:border-accent/40',
                )}
              >
                <input
                  type="radio"
                  name="template"
                  value={option.id}
                  checked={selected}
                  onChange={() => setPresetId(option.id)}
                  className="mt-1 accent-[var(--accent,#c2410c)]"
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-black text-ink">
                    {option.partCount > 0 ? (
                      <Truck size={15} className="shrink-0 text-accent" />
                    ) : (
                      <Package size={15} className="shrink-0 text-muted" />
                    )}
                    {option.name}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">
                    {option.description}
                  </span>
                  {option.partCount > 0 && (
                    <span className="mt-1 inline-block rounded-full bg-panel-2 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-muted">
                      {option.partCount} parts
                    </span>
                  )}
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-700 dark:text-red-300"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="mt-5 flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-accent px-5 text-sm font-black uppercase tracking-wide text-accent-ink shadow-lg transition active:scale-[0.99] disabled:opacity-60"
      >
        {busy ? (
          <LoaderCircle size={20} className="animate-spin" />
        ) : (
          <Truck size={20} />
        )}
        {busy ? 'Creating your van...' : submitLabel}
      </button>

      <p className="mt-3 text-center text-[10px] font-semibold leading-relaxed text-muted">
        You can add parts, rename the van, or load another trade template later
        from Manage Van Templates.
      </p>
    </form>
  )
}
