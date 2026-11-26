export {}

export type DesktopUpdateState =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'blocked'
  | 'disabled'
  | 'error'

export interface DesktopUpdateStatus {
  state: DesktopUpdateState
  version: string | null
  percent: number
  error: string | null
  entitled: boolean
}

declare global {
  interface Window {
    trucktapDesktop?: {
      isDesktop: boolean
      platform: string
      updates: {
        getStatus: () => Promise<DesktopUpdateStatus>
        check: () => Promise<DesktopUpdateStatus>
        setEntitlement: (payload: {
          allowed: boolean
          updatesUntil: string | null
          plan: string | null
        }) => Promise<DesktopUpdateStatus>
        download: () => Promise<DesktopUpdateStatus>
        install: () => Promise<{ ok: boolean; error?: string }>
        onStatus: (
          callback: (status: DesktopUpdateStatus) => void,
        ) => () => void
      }
    }
  }
}
