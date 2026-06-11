import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled UI error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--surface-base)' }}>
          <div className="max-w-md text-center space-y-4">
            <h1 className="font-serif text-xl font-semibold">Something went wrong</h1>
            <p className="text-sm text-secondary">
              An unexpected error occurred. Your work up to this point is saved on the server.
            </p>
            <p className="text-xs font-mono-ref text-muted break-all">{this.state.error.message}</p>
            <button
              type="button"
              className="btn-primary btn-sm px-4"
              onClick={() => { this.setState({ error: null }); window.location.assign('/') }}
            >
              Reload application
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
