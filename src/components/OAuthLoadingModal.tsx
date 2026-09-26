/**
 * OAuthLoadingModal - Modal for OAuth authentication progress
 * Displays loading states, instructions, and progress feedback
 * Requirements: 6.1, 6.2, 6.3
 */

import React from 'react';
import { FaSpinner, FaExternalLinkAlt, FaCheckCircle, FaTimesCircle } from 'react-icons/fa';
import ProgressBar from './ProgressBar';
import useEscapeKey from '../utils/useEscapeKey';

export type OAuthLoadingState = 
  | 'initiating'
  | 'waiting_for_browser'
  | 'exchanging_tokens'
  | 'storing_tokens'
  | 'success'
  | 'error';

export interface OAuthLoadingModalProps {
  isOpen: boolean;
  state: OAuthLoadingState;
  providerName: string;
  message?: string;
  errorMessage?: string;
  progress?: number;
  onCancel?: () => void;
  onRetry?: () => void;
  onClose?: () => void;
  authUrl?: string;
}

const OAuthLoadingModal: React.FC<OAuthLoadingModalProps> = ({
  isOpen,
  state,
  providerName,
  message,
  errorMessage,
  progress,
  onCancel,
  onRetry,
  onClose,
  authUrl
}) => {
  useEscapeKey(onCancel || onClose, isOpen);
  if (!isOpen) return null;

  const getStateConfig = () => {
    switch (state) {
      case 'initiating':
        return {
          icon: <FaSpinner className="fa-spin oauth-loading-icon-primary" />,
          title: 'Initializing Authentication',
          message: message || `Setting up secure connection to ${providerName}...`,
          showProgress: false,
          showCancel: true
        };
      
      case 'waiting_for_browser':
        return {
          icon: <FaExternalLinkAlt className="oauth-loading-icon-primary" />,
          title: 'Waiting for Authentication',
          message: message || `Please complete the authentication in your browser.`,
          instructions: [
            'A browser window should have opened automatically',
            `Sign in to your ${providerName} account`,
            'Grant the requested permissions',
            'You will be redirected back automatically'
          ],
          showProgress: false,
          showCancel: true,
          showManualLink: true
        };
      
      case 'exchanging_tokens':
        return {
          icon: <FaSpinner className="fa-spin oauth-loading-icon-primary" />,
          title: 'Completing Authentication',
          message: message || 'Exchanging authorization code for access tokens...',
          showProgress: true,
          showCancel: false
        };
      
      case 'storing_tokens':
        return {
          icon: <FaSpinner className="fa-spin oauth-loading-icon-primary" />,
          title: 'Securing Your Credentials',
          message: message || 'Storing tokens securely...',
          showProgress: true,
          showCancel: false
        };
      
      case 'success':
        return {
          icon: <FaCheckCircle className="oauth-loading-icon-success" />,
          title: 'Authentication Successful!',
          message: message || `Successfully connected to ${providerName}`,
          showProgress: false,
          showCancel: false,
          showClose: true
        };
      
      case 'error':
        return {
          icon: <FaTimesCircle className="oauth-loading-icon-error" />,
          title: 'Authentication Failed',
          message: errorMessage || 'An error occurred during authentication',
          showProgress: false,
          showCancel: false,
          showRetry: true,
          showClose: true
        };
      
      default:
        return {
          icon: <FaSpinner className="fa-spin oauth-loading-icon-primary" />,
          title: 'Processing',
          message: message || 'Please wait...',
          showProgress: false,
          showCancel: true
        };
    }
  };

  const config = getStateConfig();

  const handleManualLink = () => {
    if (authUrl) {
      window.open(authUrl, '_blank');
    }
  };

  return (
    <div className="modal-overlay oauth-loading-modal-overlay">
      <div className="modal-content oauth-loading-modal">
        <div className="oauth-loading-icon-container">
          {config.icon}
        </div>
        
        <h2 className="oauth-loading-title">{config.title}</h2>
        
        <p className="oauth-loading-message">{config.message}</p>
        
        {config.instructions && (
          <div className="oauth-loading-instructions">
            <ol>
              {config.instructions.map((instruction, index) => (
                <li key={index}>{instruction}</li>
              ))}
            </ol>
          </div>
        )}
        
        {config.showProgress && (
          <div className="oauth-loading-progress">
            <ProgressBar
              progress={progress !== undefined ? progress : 0}
              showPercentage={progress !== undefined}
              animated={true}
              size="medium"
            />
          </div>
        )}
        
        {config.showManualLink && authUrl && (
          <div className="oauth-loading-manual-link">
            <p className="oauth-loading-help-text">
              Browser didn't open automatically?
            </p>
            <button
              className="oauth-loading-manual-btn"
              onClick={handleManualLink}
            >
              <FaExternalLinkAlt />
              Open Authentication Page Manually
            </button>
          </div>
        )}
        
        <div className="oauth-loading-actions">
          {config.showCancel && onCancel && (
            <button
              className="oauth-loading-btn oauth-loading-btn-cancel"
              onClick={onCancel}
            >
              Cancel
            </button>
          )}
          
          {config.showRetry && onRetry && (
            <button
              className="oauth-loading-btn oauth-loading-btn-retry"
              onClick={onRetry}
            >
              Try Again
            </button>
          )}
          
          {config.showClose && onClose && (
            <button
              className="oauth-loading-btn oauth-loading-btn-primary"
              onClick={onClose}
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OAuthLoadingModal;