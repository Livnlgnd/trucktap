import { useCallback, useEffect, useState } from 'react'
import type { DesktopUpdateStatus } from '../desktop'
import { updatesAreActive, type TruckTapLicenseState } from '../lib/license'

export function useDesktopUpdate(state: TruckTapLicenseState | null) {
  const [status, setStatus] = useState<DesktopUpdateStatus | null>(null)
  const api = window.trucktapDesktop?.updates

  useEffect(() => {
    if (!api) return
    let active = true
    api
      .getStatus()
      .then((next) => {
        if (active) setStatus(next)
      })
      .catch(() => undefined)
    const unsubscribe = api.onStatus((next) => {
      if (active) setStatus(next)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [api])

  useEffect(() => {
    if (!api || !state) return
    const allowed = state.valid
      ? updatesAreActive(state)
      : !state.trialExpired
    void api
      .setEntitlement({
        allowed,
        updatesUntil: state.updatesUntil,
        plan: state.planId,
      })
      .then(setStatus)
      .catch(() => undefined)
  }, [api, state?.valid, state?.updatesUntil, state?.trialExpired, state?.planId])

  const check = useCallback(async () => {
    if (!api) return null
    const next = await api.check()
    setStatus(next)
    return next
  }, [api])

  const download = useCallback(async () => {
    if (!api) return null
    const next = await api.download()
    setStatus(next)
    return next
  }, [api])

  const install = useCallback(async () => {
    if (!api) return { ok: false, error: 'Updates are only available in the desktop app.' }
    return api.install()
  }, [api])

  return { status, check, download, install }
}
