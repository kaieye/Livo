import React, { Component, type ErrorInfo, type ReactNode } from 'react'
import i18next from 'i18next'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('React Error Boundary caught:', error, errorInfo)
    void window.api.app.reportError({
      source: 'react-error-boundary',
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack || undefined,
    })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: 40,
            fontFamily: 'sans-serif',
            color: '#333',
          }}
        >
          <h2 style={{ color: '#FF5C00' }}>
            {i18next.t('errorBoundary.title')}
          </h2>
          <p style={{ color: '#666' }}>{i18next.t('errorBoundary.message')}</p>
          <pre
            style={{
              background: '#f5f5f5',
              padding: 16,
              borderRadius: 8,
              overflow: 'auto',
              fontSize: 13,
              color: '#c00',
            }}
          >
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16,
              padding: '8px 16px',
              background: '#FF5C00',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            {i18next.t('errorBoundary.reload')}
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
