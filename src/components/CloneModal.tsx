import React, { useState, useEffect } from 'react';
import './cloneModal.css';
import { useLanguage } from '../i18n/LanguageContext';
import useEscapeKey from '../utils/useEscapeKey';

interface CloneModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (url: string, targetDir: string, branch?: string) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

const CloneModal: React.FC<CloneModalProps> = ({ open, onClose, onSubmit, showToast }) => {
  const { t } = useLanguage();
  const [url, setUrl] = useState('');
  const [targetDir, setTargetDir] = useState('');
  const [branch, setBranch] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEscapeKey(onClose, open);

  useEffect(() => {
    if (open) {
      setUrl('');
      setTargetDir('');
      setBranch('');
      setShowAdvanced(false);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const isValid = !!url.trim() && !!targetDir.trim();

  const handleSubmit = () => {
    if (!isValid) {
      return;
    }
    onSubmit(url.trim(), targetDir.trim(), branch.trim() || undefined);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSubmit();
    }
  };

  const handleSelectDirectory = async () => {
    const isTauri = typeof window !== 'undefined' &&
      ((window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__ ||
        typeof (window as any).__TAURI_INVOKE__ === 'function');
    console.log('[CloneModal] Tauri detection:', isTauri);
    console.log('[CloneModal] Window object:', typeof window);
    console.log('[CloneModal] __TAURI__ property:', (window as any).__TAURI__);

    if (isTauri) {
      // Tauri version: Use Tauri dialog
      try {
        console.log('[CloneModal] Using Tauri directory dialog');
        const { openDirectoryDialog } = await import('../tauriFileHandler');
        console.log('[CloneModal] Imported openDirectoryDialog function');

        const selectedPath = await openDirectoryDialog();
        console.log('[CloneModal] Directory dialog returned:', selectedPath);

        if (selectedPath) {
          console.log('Selected directory (Tauri):', selectedPath);
          setTargetDir(selectedPath);
        } else {
          console.log('[CloneModal] No directory selected or dialog cancelled');
        }
      } catch (error: any) {
        console.error('Tauri directory selection error:', error);
        showToast(`${t('modals.clone.error_generic')}: ${error.message}`, 'error');
      }
    } else {
      // Web version: Use File System Access API
      try {
        // Check if the API is supported
        if ('showDirectoryPicker' in window) {
          const dirHandle = await (window as any).showDirectoryPicker({
            mode: 'readwrite',
            startIn: 'downloads' // Start in downloads folder
          });

          // Verify we can write to the directory
          try {
            const testFileName = '.easyeditor-test';
            const testFileHandle = await dirHandle.getFileHandle(testFileName, { create: true });
            await testFileHandle.remove();
          } catch (permError) {
            showToast(t('modals.clone.error_permission'), 'error');
            return;
          }

          // Get the directory name (browser security prevents getting full path)
          // Store both name and handle
          const dirName = dirHandle.name;

          // Try to build a more descriptive path
          // Note: Browser security limits what we can show
          let displayPath = dirName;

          // Check if we can resolve any parent info (usually we can't due to security)
          try {
            // Most browsers don't allow this, but we can try
            if ((dirHandle as any).resolve) {
              const resolved = await (dirHandle as any).resolve();
              console.log('Resolved path:', resolved);
              if (resolved && resolved.length > 0) {
                displayPath = resolved.join('/');
              }
            }
          } catch (e) {
            console.log('Cannot resolve full path (browser security):', e);
          }

          console.log('Selected directory handle:', dirHandle);
          console.log('Directory name:', dirName);
          console.log('Display path:', displayPath);

          setTargetDir(displayPath);

          // Store the handle and additional info for later use
          (window as any).selectedDirHandle = dirHandle;
          (window as any).selectedDirName = dirName;
        } else {
          // Fallback: show input field with helpful message
          showToast(t('modals.clone.error_browser_support'), 'warning');
        }
      } catch (error: any) {
        // User cancelled or error occurred
        if (error.name === 'AbortError') {
          // User cancelled - do nothing
          return;
        } else if (error.name === 'SecurityError') {
          showToast(t('modals.clone.error_security'), 'error');
        } else {
          console.error('Directory selection error:', error);
          showToast(t('modals.clone.error_generic'), 'error');
        }
      }
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content clone-modal">
        <h2>{t('modals.clone.title')}</h2>
        <p>{t('modals.clone.subtitle')}</p>

        <div className="clone-input-group">
          <label htmlFor="repo-url">{t('modals.clone.repo_url')}</label>
          <input
            id="repo-url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={t('modals.clone.repo_url_placeholder')}
            autoFocus
          />
          <small style={{ color: 'var(--color-text-secondary)', fontSize: '0.85em', marginTop: '4px', display: 'block' }}>
            {t('modals.clone.repo_url_note')}
          </small>
        </div>

        <div className="clone-input-group">
          <label htmlFor="target-dir">{t('modals.clone.target_dir')}</label>
          <div className="directory-input-container">
            <input
              id="target-dir"
              type="text"
              value={targetDir}
              onChange={(e) => setTargetDir(e.target.value)}
              placeholder={t('modals.clone.target_dir_placeholder')}
            />
            <button
              onClick={handleSelectDirectory}
              className="directory-select-btn"
              type="button"
            >
              {t('actions.browse')}
            </button>
          </div>
          <small style={{ color: 'var(--color-text-secondary)', fontSize: '0.85em', marginTop: '4px', display: 'block' }}>
            {targetDir ? `${t('modals.clone.target_dir_selected')}${targetDir}` : t('modals.clone.target_dir_note')}
          </small>
        </div>

        <div className="advanced-toggle">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="toggle-button"
            type="button"
          >
            {showAdvanced ? '▼' : '▶'} {t('modals.clone.advanced')}
          </button>
        </div>

        {showAdvanced && (
          <div className="advanced-options">
            <div className="clone-input-group">
              <label htmlFor="branch">{t('modals.clone.branch')}</label>
              <input
                id="branch"
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder={t('modals.clone.branch_placeholder')}
              />
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button onClick={onClose} className="modal-button cancel-button">{t('actions.cancel')}</button>
          <button
            onClick={handleSubmit}
            className={`modal-button submit-button ${isValid ? 'submit-button-active' : 'submit-button-disabled'}`}
            disabled={!isValid}
          >
            {t('modals.clone.submit')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CloneModal;