import { Component } from 'react';
import ErrorScreen from './ErrorScreen';
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
        <div className="error-boundary">
          <ErrorScreen variant="unexpected" onRetry={this.handleReload} retryLabel="Reload">
            <button className="btn btn-secondary" onClick={() => this.setState({ showReportSheet: true })} id="report-problem-btn">
              Report this problem
            </button>
          </ErrorScreen>
          {this.state.showReportSheet && (
            <BugReportSheet error={this.state.error} onClose={() => this.setState({ showReportSheet: false })} />
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
