import { Component } from 'react';
import Icon from './Icon';
import BugReportSheet from './BugReportSheet';

/**
 * Catches render-time crashes anywhere below it so a single broken screen
 * never shows users a blank white page. The technical error is logged to the
 * console (and any attached monitoring); the user sees a calm recovery screen.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, showReportSheet: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Detailed diagnostics for operators — never shown to the user.
    console.error('[WellCircle] UI crash:', error, info?.componentStack);
  }

  handleReload = () => {
    // Reset state first in case reload is blocked; then do a hard reload.
    this.setState({ hasError: false });
    if (typeof window !== 'undefined') window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary" role="alert" style={fallbackStyle}>
          <div style={{ marginBottom: 12 }}><Icon name="leaf" size={40} /></div>
          <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>Something went wrong</h2>
          <p style={{ margin: '0 0 20px', color: 'var(--text-muted, #6b7280)', maxWidth: 280 }}>
            We hit a snag loading this screen. Please try again.
          </p>
          <div className="flex gap-8">
            <button className="btn btn-primary" onClick={this.handleReload}>
              Reload
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => this.setState({ showReportSheet: true })}
              id="report-problem-btn"
            >
              Report this problem
            </button>
          </div>
          {this.state.showReportSheet && (
            <BugReportSheet
              error={this.state.error}
              onClose={() => this.setState({ showReportSheet: false })}
            />
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

const fallbackStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  minHeight: '60vh',
  padding: 24,
};
