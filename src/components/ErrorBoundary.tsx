import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            minHeight: '100vh',
            background: '#1A1A2E',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            textAlign: 'center',
            fontFamily: 'Nunito, sans-serif',
            color: '#fff',
          }}
        >
          <span style={{ fontSize: '64px', marginBottom: '16px' }}>⚠️</span>
          <h1
            style={{
              fontFamily: 'Fredoka One, sans-serif',
              fontSize: '28px',
              marginBottom: '8px',
              color: '#fff',
            }}
          >
            Hoppla! Etwas ist schiefgelaufen.
          </h1>
          <p style={{ fontSize: '15px', color: '#9CA3AF', maxWidth: '380px', marginBottom: '32px' }}>
            Ein unerwarteter Fehler ist aufgetreten. Dein Fortschritt wurde gespeichert.
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            style={{
              background: '#6C3CE1',
              color: '#fff',
              border: 'none',
              borderRadius: '50px',
              padding: '14px 40px',
              fontSize: '16px',
              fontFamily: 'Nunito, sans-serif',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ← Zur Startseite
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
