import React, { useState, useEffect } from 'react';
import './commitModal.css';
import useEscapeKey from '../utils/useEscapeKey';

interface CommitModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (message: string, description?: string) => void;
  modifiedFiles?: string[];
}

const CommitModal: React.FC<CommitModalProps> = ({ 
  open, 
  onClose, 
  onSubmit,
  modifiedFiles = []
}) => {
  const [message, setMessage] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  useEscapeKey(onClose, open);

  useEffect(() => {
    if (open) {
      setMessage('');
      setDescription('');
      setError('');
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const handleSubmit = () => {
    // Validation
    if (!message.trim()) {
      setError('Commit message is required');
      return;
    }

    if (message.trim().length < 3) {
      setError('Commit message must be at least 3 characters');
      return;
    }

    if (message.length > 72) {
      setError('Commit message should be 72 characters or less (current: ' + message.length + ')');
      return;
    }

    // Clear error and submit
    setError('');
    const fullMessage = description.trim() 
      ? `${message.trim()}\n\n${description.trim()}`
      : message.trim();
    
    onSubmit(fullMessage);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    // Allow Shift+Enter for new lines in description
    if (e.key === 'Enter' && !e.shiftKey && (e.target as HTMLElement).id === 'commit-message') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content commit-modal">
        <h2>Commit Changes</h2>
        <p className="modal-description">
          Create a commit with your staged changes
        </p>

        {modifiedFiles.length > 0 && (
          <div className="modified-files-section">
            <h3>Modified Files ({modifiedFiles.length})</h3>
            <ul className="modified-files-list">
              {modifiedFiles.map((file, index) => (
                <li key={index}>
                  <span className="file-icon">📝</span>
                  <span className="file-path">{file}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="commit-input-group">
          <label htmlFor="commit-message">
            Commit Message <span className="required">*</span>
          </label>
          <input
            id="commit-message"
            type="text"
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              setError('');
            }}
            onKeyPress={handleKeyPress}
            placeholder="Brief description of changes (max 72 chars)"
            maxLength={100}
            autoFocus
          />
          <div className="char-counter">
            <span className={message.length > 72 ? 'warning' : ''}>
              {message.length} / 72 characters
            </span>
          </div>
        </div>

        <div className="commit-input-group">
          <label htmlFor="commit-description">
            Extended Description <span className="optional">(optional)</span>
          </label>
          <textarea
            id="commit-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Additional details about the changes (optional)&#10;Use Shift+Enter for new lines"
            rows={4}
          />
        </div>

        {error && (
          <div className="error-message">
            ⚠️ {error}
          </div>
        )}

        <div className="commit-tips">
          <strong>💡 Commit Message Tips:</strong>
          <ul>
            <li>Use imperative mood: "Add feature" not "Added feature"</li>
            <li>Keep the first line under 72 characters</li>
            <li>Be clear and descriptive</li>
          </ul>
        </div>

        <div className="modal-actions">
          <button onClick={onClose} className="modal-button cancel-button">Cancel</button>
          <button 
            onClick={handleSubmit} 
            className="modal-button submit-button"
            disabled={!message.trim()}
          >
            Commit
          </button>
        </div>
      </div>
    </div>
  );
};

export default CommitModal;
