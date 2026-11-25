import { Capacitor } from '@capacitor/core'

export function isDesktopApp(): boolean {
  return Boolean(window.trucktapDesktop?.isDesktop)
}

export function isNativeMobile(): boolean {
  return Capacitor.isNativePlatform()
}

export const WEBSITE_BASE = 'https://livnlgnd.github.io/trucktap/'
