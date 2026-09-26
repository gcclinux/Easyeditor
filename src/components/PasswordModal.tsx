import React, { useState, useEffect } from 'react';
import useEscapeKey from '../utils/useEscapeKey';
import './passwordModal.css';

interface PasswordModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (password: string) => void;
  title: string;
  promptText: string;
}

const PasswordModal: React.FC<PasswordModalProps> = ({ open, onClose, onSubmit, title, promptText }) => {
  useEscapeKey(onClose, open);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword('');
      setShowPassword(false);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const handleSubmit = () => {
    onSubmit(password);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content password-modal">
        <h2>{title}</h2>
        <p>{promptText}</p>
        <div className="password-input-container">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyPress={handleKeyPress}
            autoFocus
          />
          <button onClick={() => setShowPassword(!showPassword)} className="password-toggle-btn" title={showPassword ? 'Hide password' : 'Show password'}>
            <span role="img" aria-label="toggle password visibility">👁️</span>
          </button>
        </div>
        <div className="modal-actions">
          <button onClick={onClose} className="modal-button cancel-button">Cancel</button>
          <button onClick={handleSubmit} className="modal-button submit-button">Submit</button>
        </div>
      </div>
    </div>
  );
};

export default PasswordModal;
