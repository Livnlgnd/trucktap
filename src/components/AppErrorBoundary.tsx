import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('TruckTap UI error', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-page px-4 text-ink">
        <div className="w-full max-w-sm rounded-3xl border border-line bg-panel p-6 text-center shadow-xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-ink text-2xl font-black">
            !
          </div>
          <h1 className="mt-4 text-xl font-black">TruckTap needs a refresh.</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            The screen hit an unexpected error. Your local taps are still saved on
            this device.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 min-h-14 w-full rounded-xl bg-accent px-4 text-sm font-black uppercase tracking-wide text-accent-ink"
          >
            Reload TruckTap
          </button>
        </div>
      </div>
    )
  }
}
