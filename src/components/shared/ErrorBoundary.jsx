// src/components/shared/ErrorBoundary.jsx
// A crash inside a page shows this, with the error and a way back, instead of
// a white screen that leaves staff stuck (13 Nov 2026: two white screens in two
// days). React only lets a class component catch render errors, hence a class.

import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Kept in the browser console with where it happened, for the fix.
    console.error('Octos page crashed:', error, info?.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div role="alert" className="max-w-xl mx-auto my-10 px-6 py-6 rounded-2xl border border-red-200 bg-red-50">
        <h2 className="text-lg font-extrabold text-red-900">Something went wrong on this page</h2>
        <p className="text-sm text-red-900/80 mt-1">
          Nothing was lost. Go back and carry on; tell Khofi what you clicked, with the message below.
        </p>
        <pre className="mt-3 p-3 rounded-lg bg-white border border-red-200 text-xs text-red-900 whitespace-pre-wrap break-words">
          {String(error?.message || error)}
        </pre>
        <div className="flex gap-2 mt-4">
          {this.props.onBack && (
            <button type="button" onClick={() => { this.setState({ error: null }); this.props.onBack() }}
                    className="h-10 px-4 rounded-xl bg-[var(--text)] text-white text-sm font-bold">Back</button>
          )}
          <button type="button" onClick={() => window.location.reload()}
                  className="h-10 px-4 rounded-xl border border-red-300 bg-white text-sm font-semibold text-red-900">Reload</button>
        </div>
      </div>
    )
  }
}
