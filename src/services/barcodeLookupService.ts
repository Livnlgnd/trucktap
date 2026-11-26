import { CATEGORIES } from '../lib/templates'

export interface BarcodeLookupResult {
  barcode: string
  name: string
  brand?: string
  category: string
  sku: string
  thumbnailUrl?: string
  needsDetailsSync: boolean
  source: 'cache' | 'open-food-facts' | 'upcitemdb' | 'stub'
}

interface CachedBarcode extends BarcodeLookupResult {
  cachedAt: string
}

const CACHE_KEY = 'trucktap.barcode-cache.v1'
const CACHE_LIMIT = 500

function readCache(): Record<string, CachedBarcode> {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, CachedBarcode>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeCache(cache: Record<string, CachedBarcode>): void {
  try {
    const entries = Object.entries(cache)
      .sort((a, b) => b[1].cachedAt.localeCompare(a[1].cachedAt))
      .slice(0, CACHE_LIMIT)
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)))
  } catch {
    // A full cache is optional.
  }
}

export function cacheBarcode(result: BarcodeLookupResult): void {
  const cache = readCache()
  cache[result.barcode] = { ...result, cachedAt: new Date().toISOString() }
  writeCache(cache)
}

export function getCachedBarcode(barcode: string): BarcodeLookupResult | null {
  const hit = readCache()[barcode.trim()]
  if (!hit) return null
  const { cachedAt: _cachedAt, ...result } = hit
  return result
}

export function mapTradeCategory(input: string): string {
  const value = input.toLowerCase()
  const matches: Array<[string, RegExp]> = [
    ['Wire & Connectors', /wire|connector|nut|terminal|tape|romex|cable|conduit|strap/],
    ['Breakers & Boxes', /breaker|panel|box|switch|outlet|gfci|receptacle/],
    ['Plumbing/Fixtures', /pvc|pipe|adapter|fitting|valve|faucet|drain|plumb|pex/],
    ['Hardware & Fasteners', /screw|bolt|nut|washer|anchor|fastener|tool|bracket/],
  ]
  for (const [category, pattern] of matches) {
    if (pattern.test(value)) return category
  }
  return CATEGORIES[CATEGORIES.length - 1]?.name ?? 'Hardware & Fasteners'
}

async function lookupOpenFoodFacts(
  barcode: string,
): Promise<BarcodeLookupResult | null> {
  const response = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(
      barcode,
    )}.json?fields=product_name,brands,categories,image_small_url`,
    { signal: AbortSignal.timeout(6000) },
  )
  if (!response.ok) return null
  const payload = (await response.json()) as {
    status?: number
    product?: {
      product_name?: string
      brands?: string
      categories?: string
      image_small_url?: string
    }
  }
  const product = payload.product
  const name = product?.product_name?.trim()
  if (!payload.status || !name) return null
  return {
    barcode,
    name,
    brand: product?.brands?.split(',')[0]?.trim(),
    category: mapTradeCategory(`${product?.categories ?? ''} ${name}`),
    sku: barcode,
    thumbnailUrl: product?.image_small_url,
    needsDetailsSync: false,
    source: 'open-food-facts',
  }
}

async function lookupUpcItemDb(
  barcode: string,
): Promise<BarcodeLookupResult | null> {
  const response = await fetch(
    `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(
      barcode,
    )}`,
    { signal: AbortSignal.timeout(6000) },
  )
  if (!response.ok) return null
  const payload = (await response.json()) as {
    items?: Array<{
      title?: string
      brand?: string
      category?: string
      images?: string[]
    }>
  }
  const item = payload.items?.[0]
  const name = item?.title?.trim()
  if (!name) return null
  return {
    barcode,
    name,
    brand: item?.brand?.trim(),
    category: mapTradeCategory(`${item?.category ?? ''} ${name}`),
    sku: barcode,
    thumbnailUrl: item?.images?.[0],
    needsDetailsSync: false,
    source: 'upcitemdb',
  }
}

export function stubBarcode(barcode: string): BarcodeLookupResult {
  return {
    barcode,
    name: `Scanned Item #${barcode.slice(-4)}`,
    category: 'Hardware & Fasteners',
    sku: barcode,
    needsDetailsSync: true,
    source: 'stub',
  }
}

export async function lookupBarcode(
  barcode: string,
  options: { online?: boolean } = {},
): Promise<BarcodeLookupResult> {
  const code = barcode.trim()
  const cached = getCachedBarcode(code)
  if (cached) return cached

  const online = options.online ?? navigator.onLine
  if (online) {
    const providers = [lookupOpenFoodFacts, lookupUpcItemDb]
    for (const provider of providers) {
      try {
        const result = await provider(code)
        if (result) {
          cacheBarcode(result)
          return result
        }
      } catch {
        // Try the next provider.
      }
    }
  }

  const stub = stubBarcode(code)
  cacheBarcode(stub)
  return stub
}
