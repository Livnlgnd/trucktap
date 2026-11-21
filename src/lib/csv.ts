import { localDateKey } from './utils'

export interface SupplierOrderRow {
  partName: string
  sku: string
  qty: number
  vans: Array<{ vanName: string; qty: number }>
}

function csvCell(value: string | number): string {
  const text = String(value)
  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`
  }
  return text
}

export function buildSupplierCsv(rows: SupplierOrderRow[]): string {
  const lines: string[][] = [
    ['Part Name', 'SKU', 'Total Qty', 'Van Breakdown'],
    ...rows.map((row) => [
      row.partName,
      row.sku,
      String(row.qty),
      row.vans.map((van) => `${van.vanName} (${van.qty})`).join('; '),
    ]),
  ]

  return lines.map((line) => line.map(csvCell).join(',')).join('\r\n')
}

export function downloadSupplierCsv(rows: SupplierOrderRow[]): void {
  const csv = buildSupplierCsv(rows)
  const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `trucktap-supplier-order-${localDateKey()}.csv`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
