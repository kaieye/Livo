import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import i18next from 'i18next'

interface Props {
  children: ReactNode
  title?: string
  description?: string
  onDismiss?: () => void
  resetKey?: string | number | boolean | null
  className?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class LocalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Local Error Boundary caught:', error, errorInfo)
    void window.api.app.reportError({
      source: `local-error-boundary:${this.props.title || 'panel'}`,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack || undefined,
    })
  }

  componentDidUpdate(prevProps: Props): void {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, error: null })
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div
        className={
          this.props.className ??
          'rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm'
        }
      >
        <div className="space-y-2">
          <div className="font-medium text-red-600 dark:text-red-400">
            {this.props.title || i18next.t('errorBoundary.panelTitle')}
          </div>
          <p className="text-text-secondary dark:text-text-dark-secondary">
            {this.props.description || i18next.t('errorBoundary.panelMessage')}
          </p>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-surface-secondary p-3 text-[11px] leading-5 text-red-600 dark:bg-surface-dark-tertiary dark:text-red-300">
            {this.state.error?.message}
          </pre>
          <div className="flex items-center gap-3">
            <button
              onClick={this.handleRetry}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white"
            >
              {i18next.t('errorBoundary.retry')}
            </button>
            {this.props.onDismiss ? (
              <button
                onClick={this.props.onDismiss}
                className="rounded-lg border border-border px-3 py-1.5 text-xs"
              >
                {i18next.t('errorBoundary.dismiss')}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    )
  }
}
