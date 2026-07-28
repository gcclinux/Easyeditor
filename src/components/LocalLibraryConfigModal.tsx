import { useState } from 'react';
import { FaFolderOpen, FaCheckCircle, FaShieldAlt, FaInfoCircle, FaTimes } from 'react-icons/fa';
import { useLanguage } from '../i18n/LanguageContext';
import { isTauriEnvironment } from '../utils/environment';
import './localLibraryConfigModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelectFolder: (customName?: string) => Promise<void>;
}

export default function LocalLibraryConfigModal({ isOpen, onClose, onSelectFolder }: Props) {
  const { t } = useLanguage();
  const [isProcessing, setIsProcessing] = useState(false);
  const [libraryName, setLibraryName] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('easynotes_locallibrary_name') || '';
    }
    return '';
  });
  const isTauri = isTauriEnvironment();

  if (!isOpen) return null;

  const handleSelect = async () => {
    setIsProcessing(true);
    try {
      await onSelectFolder(libraryName.trim() || undefined);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="locallib-modal-overlay" onClick={onClose}>
      <div className="locallib-modal-content" onClick={e => e.stopPropagation()}>
        <button className="locallib-modal-close" onClick={onClose} title="Close">
          <FaTimes />
        </button>

        <div className="locallib-modal-header">
          <div className="locallib-modal-icon">
            <FaFolderOpen />
          </div>
          <h2>{t('easynotes.local_library') || 'Local Library Setup'}</h2>
          <p className="locallib-modal-subtitle">
            Configure a persistent local folder on your computer for your EasyNotes library.
          </p>
        </div>

        <div className="locallib-modal-body">
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-dropdown, #e1e4ea)', marginBottom: '6px' }}>
              {t('easynotes.library_name') || 'Library Name'}
            </label>
            <input
              type="text"
              value={libraryName}
              onChange={e => setLibraryName(e.target.value)}
              placeholder={t('easynotes.library_name_placeholder') || 'e.g. Personal Notes, Work Vault'}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border-secondary, #333a4d)',
                backgroundColor: 'var(--bg-main, #141721)',
                color: 'var(--color-text-dropdown, #e1e4ea)',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div className="locallib-features-list">
            <div className="locallib-feature-item">
              <FaCheckCircle className="feature-icon check" />
              <div>
                <strong>Persistent Local Storage</strong>
                <p>Your notes stay saved directly on your computer's storage.</p>
              </div>
            </div>
            <div className="locallib-feature-item">
              <FaCheckCircle className="feature-icon check" />
              <div>
                <strong>Offline First & Private</strong>
                <p>No cloud account required. Access and edit your files anytime offline.</p>
              </div>
            </div>
          </div>

          {!isTauri && (
            <div className="locallib-permission-notice">
              <FaShieldAlt className="notice-icon" />
              <div>
                <strong>Browser Permission Notice</strong>
                <p>
                  After picking a folder, your browser will ask <em>"Allow this site to edit files?"</em>. Click <strong>Allow</strong> to grant permission.
                </p>
              </div>
            </div>
          )}

          {isTauri && (
            <div className="locallib-tauri-notice">
              <FaInfoCircle className="notice-icon" />
              <div>
                <strong>Desktop Native Storage</strong>
                <p>Direct filesystem access is enabled in desktop mode.</p>
              </div>
            </div>
          )}
        </div>

        <div className="locallib-modal-footer">
          <button className="locallib-btn-secondary" onClick={onClose} disabled={isProcessing}>
            {t('easynotes.cancel') || 'Cancel'}
          </button>
          <button className="locallib-btn-primary" onClick={handleSelect} disabled={isProcessing}>
            <FaFolderOpen style={{ marginRight: '6px' }} />
            {isProcessing ? 'Opening Folder Selector...' : (t('easynotes.select_local_library') || 'Select Library Folder')}
          </button>
        </div>
      </div>
    </div>
  );
}
