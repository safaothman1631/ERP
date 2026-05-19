import React from 'react';
import { Button, Result, Space } from 'antd';
import { HomeOutlined, ReloadOutlined } from '@ant-design/icons';
import i18n from '../i18n';

interface ErrorBoundaryState {
  hasError: boolean;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

/**
 * ErrorBoundary — catches render errors and shows a friendly error screen.
 *
 * Displays:
 * - Translated error message (uses i18n)
 * - "Retry" button to reset the boundary
 * - "Go to Dashboard" link to navigate home
 *
 * Requirements: 4.1, 9.6
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log error for diagnostics without exposing to user
    console.error('[ErrorBoundary] Caught error:', error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  handleGoToDashboard = () => {
    // Navigate to dashboard — use window.location to avoid router dependency
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="error"
          title={i18n.t('error_boundary')}
          subTitle={i18n.t('error_boundary_desc')}
          extra={
            <Space wrap>
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={this.handleRetry}
                aria-label={i18n.t('try_again')}
              >
                {i18n.t('try_again')}
              </Button>
              <Button
                icon={<HomeOutlined />}
                onClick={this.handleGoToDashboard}
                aria-label={i18n.t('go_to_dashboard', 'Go to Dashboard')}
              >
                {i18n.t('go_to_dashboard', 'Go to Dashboard')}
              </Button>
            </Space>
          }
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
