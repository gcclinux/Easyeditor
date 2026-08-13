/**
 * OAuthErrorModal - Modal for displaying OAuth authentication errors
 * Provides specific error messages with suggested actions for resolution
 * Requirements: 6.5
 */

import React, { useEffect } from 'react';
import { trackError } from '../services/analytics';
import { 
  FaExclamationTriangle, 
  FaTimesCircle, 
  FaExternalLinkAlt, 
  FaRedo, 
  FaCog,
  FaShieldAlt,
  FaWifi,
  FaUserTimes
} from 'react-icons/fa';

export type OAuthErrorType = 
  | 'browser_launch_failed'
  | 'user_cancelled'
  | 'network_error'
  | 'server_error'
  | 'invalid_grant'
  | 'access_denied'
  | 'timeout'
  | 'csrf_attack'
  | 'token_storage_error'
  | 'provider_not_found'
  | 'unknown_error';

export interface OAuthErrorModalProps {
  isOpen: boolean;
  errorType: OAuthErrorType;
  errorMessage: string;
  providerName: string;
  authUrl?: string;
  onRetry?: () => void;
  onClose: () => void;
  onOpenSettings?: () => void;
}

const OAuthErrorModal: React.FC<OAuthErrorModalProps> = ({
  isOpen,
  errorType,
  errorMessage,
  providerName,
  authUrl,
  onRetry,
  onClose,
  onOpenSettings
}) => {
  useEffect(() => {
    if (isOpen) {
      trackError('cloud', `OAuth ${providerName} (${errorType}): ${errorMessage}`);
    }
  }, [isOpen, errorType, errorMessage, providerName]);

  if (!isOpen) return null;

  const getErrorConfig = () => {
    switch (errorType) {
      case 'browser_launch_failed':
        return {
          icon: <FaExternalLinkAlt className="oauth-error-icon-warning" />,
          title: 'Browser Launch Failed',
          description: 'Unable to open your web browser automatically.',
          suggestions: [
            'Try clicking "Open Manually" below to open the authentication page',
            'Check if your default browser is set correctly',
            'Temporarily disable browser security extensions',
            'Try restarting the application'
          ],
          showManualLink: true,
          showRetry: true,
          severity: 'warning'
        };

      case 'user_cancelled':
        return {
          icon: <FaUserTimes className="oauth-error-icon-info" />,
          title: 'Authentication Cancelled',
          description: 'You cancelled the authentication process.',
          suggestions: [
            'Click "Try Again" to restart the authentication process',
            'Make sure to complete all steps in the browser',
            'Grant the necessary permissions when prompted'
          ],
          showRetry: true,
          severity: 'info'
        };

      case 'network_error':
        return {
          icon: <FaWifi className="oauth-error-icon-error" />,
          title: 'Network Connection Error',
          description: 'Unable to connect to the authentication server.',
          suggestions: [
            'Check your internet connection',
            'Try again in a few moments',
            'Check if your firewall is blocking the connection',
            'Contact your network administrator if the problem persists'
          ],
          showRetry: true,
          severity: 'error'
        };

      case 'server_error':
        return {
          icon: <FaTimesCircle className="oauth-error-icon-error" />,
          title: 'Server Error',
          description: `${providerName} servers are experiencing issues.`,
          suggestions: [
            'Try again in a few minutes',
            `Check ${providerName} status page for known issues`,
            'Contact support if the problem continues'
          ],
          showRetry: true,
          severity: 'error'
        };

      case 'invalid_grant':
        return {
          icon: <FaShieldAlt className="oauth-error-icon-error" />,
          title: 'Authentication Expired',
          description: 'Your authentication session has expired or is invalid.',
          suggestions: [
            'Click "Try Again" to start a fresh authentication',
            'Make sure you complete the process within the time limit',
            'Clear your browser cache and cookies if the problem persists'
          ],
          showRetry: true,
          severity: 'error'
        };

      case 'access_denied':
        return {
          icon: <FaShieldAlt className="oauth-error-icon-warning" />,
          title: 'Access Denied',
          description: 'Permission was denied during authentication.',
          suggestions: [
            'Make sure to grant all requested permissions',
            'Check if your account has the necessary privileges',
            'Try signing in with a different account if needed',
            'Contact your administrator if this is a work account'
          ],
          showRetry: true,
          severity: 'warning'
        };

      case 'timeout':
        return {
          icon: <FaExclamationTriangle className="oauth-error-icon-warning" />,
          title: 'Authentication Timeout',
          description: 'The authentication process took too long to complete.',
          suggestions: [
            'Try again and complete the process more quickly',
            'Check your internet connection speed',
            'Close unnecessary browser tabs to improve performance'
          ],
          showRetry: true,
          severity: 'warning'
        };

      case 'csrf_attack':
        return {
          icon: <FaShieldAlt className="oauth-error-icon-error" />,
          title: 'Security Error',
          description: 'A security issue was detected during authentication.',
          suggestions: [
            'This may indicate a security threat',
            'Try again with a fresh authentication attempt',
            'Make sure you\'re using the official application',
            'Contact support if this error persists'
          ],
          showRetry: true,
          severity: 'error'
        };

      case 'token_storage_error':
        return {
          icon: <FaCog className="oauth-error-icon-error" />,
          title: 'Storage Error',
          description: 'Unable to securely store your authentication credentials.',
          suggestions: [
            'Check if you have sufficient disk space',
            'Try running the application as administrator',
            'Check your system\'s security settings',
            'Contact support if the problem continues'
          ],
          showRetry: true,
          showSettings: true,
          severity: 'error'
        };

      case 'provider_not_found':
        return {
          icon: <FaCog className="oauth-error-icon-error" />,
          title: 'Configuration Error',
          description: `${providerName} is not properly configured.`,
          suggestions: [
            'This is likely a configuration issue',
            'Try restarting the application',
            'Contact support for assistance'
          ],
          showSettings: true,
          severity: 'error'
        };

      default:
        return {
          icon: <FaExclamationTriangle className="oauth-error-icon-error" />,
          title: 'Authentication Error',
          description: 'An unexpected error occurred during authentication.',
          suggestions: [
            'Try again in a few moments',
            'Restart the application if the problem persists',
            'Contact support if you continue to experience issues'
          ],
          showRetry: true,
          severity: 'error'
        };
    }
  };

  const config = getErrorConfig();

  const handleManualLink = () => {
    if (authUrl) {
      window.open(authUrl, '_blank');
    }
  };

  return (
    <div className="modal-overlay oauth-error-modal-overlay">
      <div className={`modal-content oauth-error-modal oauth-error-${config.severity}`}>
        <div className="oauth-error-icon-container">
          {config.icon}
        </div>
        
        <h2 className="oauth-error-title">{config.title}</h2>
        
        <p className="oauth-error-description">{config.description}</p>
        
        <div className="oauth-error-message">
          <strong>Error Details:</strong> {errorMessage}
        </div>
        
        <div className="oauth-error-suggestions">
          <h4>Suggested Solutions:</h4>
          <ul>
            {config.suggestions.map((suggestion, index) => (
              <li key={index}>{suggestion}</li>
            ))}
          </ul>
        </div>
        
        {config.showManualLink && authUrl && (
          <div className="oauth-error-manual-link">
            <button
              className="oauth-error-manual-btn"
              onClick={handleManualLink}
            >
              <FaExternalLinkAlt />
              Open Authentication Page Manually
            </button>
          </div>
        )}
        
        <div className="oauth-error-actions">
          <button
            className="oauth-error-btn oauth-error-btn-close"
            onClick={onClose}
          >
            Close
          </button>
          
          {config.showSettings && onOpenSettings && (
            <button
              className="oauth-error-btn oauth-error-btn-settings"
              onClick={onOpenSettings}
            >
              <FaCog />
              Settings
            </button>
          )}
          
          {config.showRetry && onRetry && (
            <button
              className="oauth-error-btn oauth-error-btn-retry"
              onClick={onRetry}
            >
              <FaRedo />
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OAuthErrorModal;