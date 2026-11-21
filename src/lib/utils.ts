export function cn(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(' ')
}

export function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`
}

export function localDateKey(date: Date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function isToday(isoDate: string | undefined): boolean {
  if (!isoDate) return false
  const date = new Date(isoDate)
  return !Number.isNaN(date.getTime()) && localDateKey(date) === localDateKey()
}

export function formatTime(isoDate: string): string {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return ''

  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function formatRelativeDay(isoDate: string): string {
  const date = new Date(isoDate)
  if (Number.isNaN(date.getTime())) return ''

  const dateKey = localDateKey(date)
  const today = localDateKey()
  if (dateKey === today) return 'Today'

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  if (dateKey === localDateKey(yesterday)) return 'Yesterday'

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export function formatDateTime(isoDate: string): string {
  return `${formatRelativeDay(isoDate)} · ${formatTime(isoDate)}`
}

export function pluralize(
  count: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return `${count} ${count === 1 ? singular : plural}`
}

export function partIdentity(part: {
  name: string
  sku?: string
}): string {
  const sku = part.sku?.trim().toLowerCase()
  return sku ? `sku:${sku}` : `name:${part.name.trim().toLowerCase()}`
}

export function haptic(pattern: number | number[] = 30): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(pattern)
  }
}

export function clampInt(value: number, min = 0, max = 999): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}
