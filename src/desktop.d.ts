export {}

declare global {
  interface Window {
    trucktapDesktop?: {
      isDesktop: boolean
      platform: string
    }
  }
}
