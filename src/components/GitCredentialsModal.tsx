import React, { useState, useEffect } from 'react';
import './gitCredentialsModal.css';
import { useLanguage } from '../i18n/LanguageContext';

interface GitCredentialsModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (username: string, token: string, rememberMe: boolean) => void;
  isSetup?: boolean; // true if setting up for first time, false if just entering credentials
  initialUsername?: string;
  initialToken?: string;
}

const GitCredentialsModal: React.FC<GitCredentialsModalProps> = ({
  open,
  onClose,
  onSubmit,
  isSetup = false,
  initialUsername = '',
  initialToken = ''
}) => {
  const { t } = useLanguage();
  const [username, setUsername] = useState(initialUsername);
  const [token, setToken] = useState(initialToken);
  const [showToken, setShowToken] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  useEffect(() => {
    if (open) {
      setUsername(initialUsername);
      setToken(initialToken);
      setShowToken(false);
      setRememberMe(true);
    }
  }, [open, initialUsername, initialToken]);

  if (!open) {
    return null;
  }

  const handleSubmit = () => {
    if (!username.trim()) {
      // Basic validation, but leave messaging to parent via toast
      return;
    }
    if (!token.trim()) {
      // Basic validation, but leave messaging to parent via toast
      return;
    }
    onSubmit(username.trim(), token.trim(), rememberMe);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSubmit();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content git-credentials-modal">
        <h2>{isSetup ? t('modals.git_credentials.title_setup') : t('modals.git_credentials.title_required')}</h2>
        <p className="modal-description">
          {isSetup
            ? t('modals.git_credentials.desc_setup')
            : t('modals.git_credentials.desc_required')}
        </p>

        <div className="credentials-input-group">
          <label htmlFor="git-username">{t('modals.git_credentials.username_label')}</label>
          <input
            id="git-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={t('modals.git_credentials.username_placeholder')}
            autoFocus
          />
          <small className="input-help" style={{ color: '#888', fontSize: '0.85em', marginTop: '4px' }} dangerouslySetInnerHTML={{ __html: t('modals.git_credentials.username_help') }} />
        </div>

        <div className="credentials-input-group">
          <label htmlFor="git-token">{t('modals.git_credentials.token_label')}</label>
          <div className="token-input-container">
            <input
              id="git-token"
              type={showToken ? 'text' : 'password'}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={t('modals.git_credentials.token_placeholder')}
            />
            <button
              onClick={() => setShowToken(!showToken)}
              className="token-toggle-btn"
              type="button"
              title={showToken ? t('modals.git_credentials.hide_token') : t('modals.git_credentials.show_token')}
            >
              <span role="img" aria-label="toggle token visibility">👁️</span>
            </button>
          </div>
          <small className="input-help">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                const url = 'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token';
                window.open(url, '_blank');
              }}
            >
              {t('modals.git_credentials.how_to_token')}
            </a>
            <span style={{ margin: '0 4px', color: '#666' }}>|</span>
            <a href="#" onClick={(e) => { e.preventDefault(); window.open('https://docs.gitlab.com/user/profile/personal_access_tokens.html', '_blank'); }}>GitLab</a>
            <span style={{ margin: '0 4px', color: '#666' }}>|</span>
            <a href="#" onClick={(e) => { e.preventDefault(); window.open('https://support.atlassian.com/bitbucket-cloud/docs/create-an-app-password/', '_blank'); }}>Bitbucket</a>
            <span style={{ margin: '0 4px', color: '#666' }}>|</span>
            <a href="#" onClick={(e) => { e.preventDefault(); window.open('https://docs.gitea.com/development/api-usage#generating-and-listing-api-tokens', '_blank'); }}>Gitea</a>
          </small>
        </div>

        <div className="remember-me-container">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <span>{t('modals.git_credentials.remember_me')}</span>
          </label>
          <small className="security-note">
            {t('modals.git_credentials.security_note')}
          </small>
        </div>

        <div className="modal-actions">
          <button onClick={onClose} className="modal-button cancel-button">{t('actions.cancel')}</button>
          <button onClick={handleSubmit} className="modal-button submit-button">
            {isSetup ? t('modals.git_credentials.submit_setup') : t('modals.git_credentials.submit_auth')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GitCredentialsModal;
