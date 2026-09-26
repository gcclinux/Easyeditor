import React, { useState, useRef } from 'react';
import './importThemeModal.css';
import { FaUpload, FaExclamationTriangle, FaFileUpload } from 'react-icons/fa';
import { useLanguage } from '../i18n/LanguageContext';
import useEscapeKey from '../utils/useEscapeKey';

interface ImportThemeModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (name: string, description: string, css: string) => void;
}

const ImportThemeModal: React.FC<ImportThemeModalProps> = ({ open, onClose, onImport }) => {
  const { t } = useLanguage();
  const [themeName, setThemeName] = useState('');
  const [themeDesc, setThemeDesc] = useState('');
  const [themeCss, setThemeCss] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEscapeKey(onClose, open);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.css')) {
      setError(t('modals.import_theme.error_file_type'));
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const css = event.target?.result as string;
      setThemeCss(css);

      // Auto-fill name from filename if empty
      if (!themeName) {
        const name = file.name.replace('.css', '').replace(/-/g, ' ');
        setThemeName(name.charAt(0).toUpperCase() + name.slice(1));
      }

      setError('');
    };
    reader.onerror = () => {
      setError(t('modals.import_theme.error_read'));
    };
    reader.readAsText(file);
  };

  const handleClose = () => {
    setThemeName('');
    setThemeDesc('');
    setThemeCss('');
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  if (!open) return null;

  const handleImport = () => {
    setError('');

    if (!themeName.trim()) {
      setError(t('modals.import_theme.error_name'));
      return;
    }

    if (!themeCss.trim()) {
      setError(t('modals.import_theme.error_css'));
      return;
    }

    // Basic validation - check if it looks like CSS
    if (!themeCss.includes(':root') && !themeCss.includes('--')) {
      setError(t('modals.import_theme.error_invalid_css'));
      return;
    }

    onImport(themeName.trim(), themeDesc.trim(), themeCss.trim());
    handleClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content import-theme-modal" onClick={(e) => e.stopPropagation()}>
        <button className="theme-close" onClick={handleClose}>✕</button>

        <div className="theme-hero">
          <div className="theme-hero-icon">
            <FaUpload size={48} />
          </div>
          <div>
            <h2 className="theme-title">{t('modals.import_theme.title')}</h2>
            <p className="theme-subtitle">{t('modals.import_theme.subtitle')}</p>
          </div>
        </div>

        <div className="import-form">
          <div className="form-group">
            <label>{t('modals.import_theme.name')} *</label>
            <input
              type="text"
              value={themeName}
              onChange={(e) => setThemeName(e.target.value)}
              placeholder={t('modals.import_theme.name_placeholder')}
              className="theme-input"
            />
          </div>

          <div className="form-group">
            <label>{t('modals.import_theme.description')}</label>
            <input
              type="text"
              value={themeDesc}
              onChange={(e) => setThemeDesc(e.target.value)}
              placeholder={t('modals.import_theme.description_placeholder')}
              className="theme-input"
            />
          </div>

          <div className="form-group">
            <label>{t('modals.import_theme.css_label')} *</label>
            <div className="file-upload-section">
              <button
                type="button"
                className="btn-file-upload"
                onClick={() => fileInputRef.current?.click()}
              >
                <FaFileUpload /> {t('modals.import_theme.load_file')}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".css"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </div>
            <textarea
              value={themeCss}
              onChange={(e) => setThemeCss(e.target.value)}
              placeholder={t('modals.import_theme.css_placeholder')}
              className="theme-textarea"
              rows={12}
            />
          </div>

          {error && (
            <div className="import-error">
              <FaExclamationTriangle /> {error}
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn secondary" onClick={handleClose}>{t('actions.cancel')}</button>
          <button className="btn primary" onClick={handleImport}>{t('modals.import_theme.submit')}</button>
        </div>
      </div>
    </div>
  );
};

export default ImportThemeModal;
