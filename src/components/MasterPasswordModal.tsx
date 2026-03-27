import React, { useState, useEffect } from 'react';
import './masterPasswordModal.css';

interface MasterPasswordModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (password: string) => void;
  onReset?: () => void;
  isSetup: boolean; // true if creating new master password, false if unlocking
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const MasterPasswordModal: React.FC<MasterPasswordModalProps> = ({
  open,
  onClose,
  onSubmit,
  onReset,
  isSetup,
  showToast
}) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const handleSubmit = () => {
    if (!password.trim()) {
      showToast('Please enter a password', 'warning');
      return;
    }

    if (password.length < 8) {
      showToast('Password must be at least 8 characters long', 'warning');
      return;
    }

    if (isSetup) {
      if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
      }
    }

    onSubmit(password);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content master-password-modal">
        <h2>{isSetup ? 'Create Master Password' : 'Unlock Git Credentials'}</h2>
        <p className="modal-description">
          {isSetup
            ? 'Create a master password to encrypt your Git credentials. You\'ll need this password to access your saved credentials.'
            : 'Enter your master password to unlock saved Git credentials.'}
        </p>

        <div className="password-input-group">
          <label htmlFor="master-password">
            {isSetup ? 'Master Password' : 'Password'}
          </label>
          <div className="password-container">
            <input
              id="master-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter password (min 8 characters)"
              autoFocus
            />
            <button
              onClick={() => setShowPassword(!showPassword)}
              className="password-toggle-btn"
              type="button"
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              <span role="img" aria-label="toggle password visibility">👁️</span>
            </button>
          </div>
        </div>

        {isSetup && (
          <div className="password-input-group">
            <label htmlFor="confirm-password">Confirm Password</label>
            <div className="password-container">
              <input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Re-enter password"
              />
            </div>
          </div>
        )}

        {isSetup && (
          <div className="warning-box">
            <strong>⚠️ Important:</strong> Remember this password! If you forget it,
            you'll need to clear your saved credentials and set them up again.
          </div>
        )}

        {!isSetup && onReset && (
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onReset();
              }}
              style={{ fontSize: '0.85em', color: '#888' }}
            >
              Forgot password? Reset credentials
            </a>
          </div>
        )}

        <div className="modal-actions">
          <button onClick={onClose} className="modal-button cancel-button">Cancel</button>
          <button onClick={handleSubmit} className="modal-button submit-button">
            {isSetup ? 'Create Password' : 'Unlock'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MasterPasswordModal;
