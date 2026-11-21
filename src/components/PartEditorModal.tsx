import { useState, type FormEvent } from 'react'
import { LoaderCircle, Save } from 'lucide-react'
import type { PartItem } from '../types'
import { savePart } from '../db'
import { CATEGORY_NAMES, getCategoryMeta } from '../lib/templates'
import { clampInt, cn, createId } from '../lib/utils'
import { Modal } from './Modal'
import { PartIcon } from './PartIcon'
import { PART_ICON_NAMES } from '../lib/partIcons'
import type { ToastTone } from './Toast'

function humanizeIconName(name: string): string {
  return name.replace(/([a-z])([A-Z0-9])/g, '$1 $2')
}

export function PartEditorModal({
  open,
  vanId,
  part,
  onClose,
  onSaved,
  onToast,
}: {
  open: boolean
  vanId: string
  part: PartItem | null
  onClose: () => void
  onSaved: () => void
  onToast: (message: string, tone?: ToastTone) => void
}) {
  const [name, setName] = useState(part?.name ?? '')
  const [sku, setSku] = useState(part?.sku ?? '')
  const [category, setCategory] = useState(
    part?.category ?? CATEGORY_NAMES[0],
  )
  const [parLevel, setParLevel] = useState(String(part?.parLevel ?? 1))
  const [usedToday, setUsedToday] = useState(
    String(part?.currentUsedToday ?? 0),
  )
  const [iconName, setIconName] = useState(part?.iconName ?? 'Package')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) {
      setError('Part name is required.')
      return
    }

    setBusy(true)
    setError('')

    const nextPart: PartItem = {
      id: part?.id ?? createId('part'),
      vanId,
      name: name.trim(),
      ...(sku.trim() ? { sku: sku.trim() } : {}),
      category,
      parLevel: clampInt(Number(parLevel), 0, 999),
      currentUsedToday: clampInt(Number(usedToday), 0, 999),
      iconName,
    }

    try {
      await savePart(nextPart)
      onToast(part ? 'Part updated.' : 'Part added to the van board.', 'success')
      onSaved()
    } catch {
      setError('Could not save this part. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const categoryMeta = getCategoryMeta(category)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={part ? 'Edit part' : 'Add a part'}
      description={
        part
          ? 'Update board details or correct the current tap count.'
          : 'Add a part to this van’s clicker board.'
      }
      size="md"
    >
      <form onSubmit={(event) => void submit(event)} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-muted">
            Part name <span className="text-red-500">*</span>
          </span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
            required
            placeholder='e.g. 20A Single-Pole Breaker'
            className="min-h-14 w-full rounded-xl border-2 border-line bg-page px-4 text-base font-bold text-ink outline-none transition placeholder:font-normal placeholder:text-muted/60 focus:border-accent focus:ring-4 focus:ring-accent/15"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-muted">
              SKU (optional)
            </span>
            <input
              type="text"
              value={sku}
              onChange={(event) => setSku(event.target.value)}
              placeholder="BRK-20SP"
              className="min-h-14 w-full rounded-xl border-2 border-line bg-page px-4 font-mono text-sm font-semibold uppercase text-ink outline-none transition placeholder:font-normal placeholder:text-muted/60 focus:border-accent focus:ring-4 focus:ring-accent/15"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-muted">
              Category
            </span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="min-h-14 w-full rounded-xl border-2 border-line bg-page px-4 text-sm font-bold text-ink outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
            >
              {CATEGORY_NAMES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-muted">
              Par level
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={999}
              value={parLevel}
              onChange={(event) => setParLevel(event.target.value)}
              className="min-h-14 w-full rounded-xl border-2 border-line bg-page px-4 text-base font-black text-ink outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-muted">
              Used today
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={999}
              value={usedToday}
              onChange={(event) => setUsedToday(event.target.value)}
              className="min-h-14 w-full rounded-xl border-2 border-line bg-page px-4 text-base font-black text-ink outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
            />
          </label>
        </div>

        <div>
          <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-muted">
            Tile icon
          </span>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                'flex h-14 w-14 shrink-0 items-center justify-center rounded-xl',
                categoryMeta.iconClass,
              )}
            >
              <PartIcon name={iconName} size={28} />
            </div>
            <select
              value={iconName}
              onChange={(event) => setIconName(event.target.value)}
              className="min-h-14 min-w-0 flex-1 rounded-xl border-2 border-line bg-page px-4 text-sm font-bold text-ink outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15"
            >
              {PART_ICON_NAMES.map((option) => (
                <option key={option} value={option}>
                  {humanizeIconName(option)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-700 dark:text-red-300"
          >
            {error}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="min-h-16 rounded-2xl border-2 border-line bg-panel px-4 text-sm font-bold text-ink transition hover:bg-panel-2 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-accent px-4 text-sm font-black uppercase tracking-wide text-accent-ink transition active:scale-[0.99] disabled:opacity-60"
          >
            {busy ? (
              <LoaderCircle size={20} className="animate-spin" />
            ) : (
              <Save size={19} />
            )}
            {busy ? 'Saving…' : part ? 'Save changes' : 'Add part'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
