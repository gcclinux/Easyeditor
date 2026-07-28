import { useState, useEffect } from 'react';
import { FaFolderOpen, FaCheckCircle, FaShieldAlt, FaInfoCircle, FaTimes, FaSave } from 'react-icons/fa';
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
  const [libraryName, setLibraryName] = useState('');
  const isTauri = isTauriEnvironment();

  useEffect(() => {
    if (isOpen) {
      setLibraryName('');
      setIsProcessing(false);
    }
  }, [isOpen]);

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
            Link a folder on your computer — notes you create will be saved directly there as <strong>.md</strong> files.
          </p>
        </div>

        <div className="locallib-modal-body">
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-dropdown, #e1e4ea)', marginBottom: '6px' }}>
              {t('easynotes.library_name') || 'Library Name'} <span style={{ fontWeight: 400, color: '#9ca3af' }}>(optional)</span>
            </label>
            <input
              type="text"
              value={libraryName}
              onChange={e => setLibraryName(e.target.value)}
              placeholder="e.g. Personal Notes, Work Vault (leave blank to use folder name)"
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

          {!isTauri && (
            <div style={{
              background: 'rgba(59,130,246,0.08)',
              border: '1px solid rgba(59,130,246,0.3)',
              borderRadius: '8px',
              padding: '12px 14px',
              marginBottom: '16px',
              display: 'flex',
              gap: '10px',
              alignItems: 'flex-start'
            }}>
              <FaSave style={{ color: '#60a5fa', marginTop: '2px', flexShrink: 0, fontSize: '16px' }} />
              <div style={{ fontSize: '13px', color: '#93c5fd', lineHeight: 1.5 }}>
                <strong style={{ display: 'block', marginBottom: '2px', color: '#bfdbfe' }}>Notes save directly to your folder</strong>
                Clicking <em>Select Folder</em> opens a picker. Your browser will ask for
                read &amp; write permission once — after that, every note you create or
                save is written as a real <code>.md</code> file inside the chosen folder.
              </div>
            </div>
          )}

          <div className="locallib-features-list">
            <div className="locallib-feature-item">
              <FaCheckCircle className="feature-icon check" />
              <div>
                <strong>Real Filesystem Storage</strong>
                <p>Notes are saved as actual <code>.md</code> files you can open in any editor.</p>
              </div>
            </div>
            <div className="locallib-feature-item">
              <FaCheckCircle className="feature-icon check" />
              <div>
                <strong>Works with Empty Folders</strong>
                <p>Start fresh — select an empty folder and fill it with new notes.</p>
              </div>
            </div>
            <div className="locallib-feature-item">
              <FaCheckCircle className="feature-icon check" />
              <div>
                <strong>Offline First &amp; Private</strong>
                <p>No cloud account required. Access and edit your files anytime offline.</p>
              </div>
            </div>
          </div>

          {isTauri && (
            <div className="locallib-tauri-notice">
              <FaInfoCircle className="notice-icon" />
              <div>
                <strong>Desktop Native Storage</strong>
                <p>Direct filesystem access is enabled — notes write to disk instantly.</p>
              </div>
            </div>
          )}

          {!isTauri && (
            <div className="locallib-tauri-notice" style={{ borderColor: 'rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.06)' }}>
              <FaShieldAlt className="notice-icon" style={{ color: '#fbbf24' }} />
              <div>
                <strong style={{ color: '#fde68a' }}>One-time browser permission</strong>
                <p>Your browser will ask permission to read &amp; write the selected folder. This only happens once when adding the library.</p>
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
            {isProcessing ? 'Opening folder picker...' : (t('easynotes.select_local_library') || 'Select Folder')}
          </button>
        </div>
      </div>
    </div>
  );
}
