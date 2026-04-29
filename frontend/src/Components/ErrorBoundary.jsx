import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', error, info);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-8" style={{ background: 'var(--bg)', color: 'var(--text-main)' }}>
          <div className="max-w-md w-full text-center space-y-4">
            <div className="text-4xl">⚠</div>
            <h1 className="text-xl font-bold">Something went wrong</h1>
            <p className="text-sm" style={{ color: 'var(--text-sec)' }}>
              An unexpected error occurred. Try refreshing the page.
            </p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              Reload page
            </button>
            {import.meta.env.DEV && this.state.error && (
              <pre className="text-left text-xs mt-4 p-4 rounded-xl overflow-auto max-h-48" style={{ background: 'var(--card-bg)', color: 'var(--text-sec)' }}>
                {this.state.error.toString()}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
