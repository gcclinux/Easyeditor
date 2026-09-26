/**
 * CloudServicesModal - Modal for managing cloud service connections
 * Integrates OAuth UI components with the existing app
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import React from 'react';
import { FaCloud, FaTimes } from 'react-icons/fa';
import OAuthUI from './OAuthUI';
import useEscapeKey from '../utils/useEscapeKey';
import './oauthUI.css';

export interface CloudServicesModalProps {
  open: boolean;
  onClose: () => void;
  onAuthenticationSuccess?: (provider: string, tokens: any) => void;
  onAuthenticationError?: (provider: string, error: string) => void;
  onProviderDisconnect?: (provider: string) => void;
}

const CloudServicesModal: React.FC<CloudServicesModalProps> = ({
  open,
  onClose,
  onAuthenticationSuccess,
  onAuthenticationError,
  onProviderDisconnect
}) => {
  useEscapeKey(onClose, open);
  if (!open) return null;

  const handleAuthSuccess = (provider: string, tokens: any) => {
    console.log(`Successfully authenticated with ${provider}:`, tokens);
    if (onAuthenticationSuccess) {
      onAuthenticationSuccess(provider, tokens);
    }
  };

  const handleAuthError = (provider: string, error: string) => {
    console.error(`Authentication failed for ${provider}:`, error);
    if (onAuthenticationError) {
      onAuthenticationError(provider, error);
    }
  };

  const handleDisconnect = (provider: string) => {
    console.log(`Disconnected from ${provider}`);
    if (onProviderDisconnect) {
      onProviderDisconnect(provider);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content cloud-services-modal">
        <div className="modal-header">
          <h2>
            <FaCloud />
            Cloud Services
          </h2>
          <button
            className="modal-close-btn"
            onClick={onClose}
            title="Close"
          >
            <FaTimes />
          </button>
        </div>
        
        <div className="modal-body">
          <p className="modal-description">
            Connect your cloud storage accounts to sync your notes and access them from anywhere.
          </p>
          
          <OAuthUI
            onAuthenticationSuccess={handleAuthSuccess}
            onAuthenticationError={handleAuthError}
            onProviderDisconnect={handleDisconnect}
            showStatusIndicator={true}
            compact={false}
          />
        </div>
        
        <div className="modal-footer">
          <p className="modal-footer-note">
            Your credentials are encrypted and stored securely on your device.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CloudServicesModal;