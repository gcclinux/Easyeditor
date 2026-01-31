import React, { useState, useEffect } from 'react';
import './themeModal.css';
import { FaPalette, FaPlus, FaTrash, FaDownload } from 'react-icons/fa';
import { getCustomThemes, deleteCustomTheme, CustomTheme } from '../customThemeManager';
import { useLanguage } from '../i18n/LanguageContext';

interface ThemeModalProps {
  open: boolean;
  onClose: () => void;
  onSelectTheme: (theme: string, isCustom?: boolean) => void;
  currentTheme: string;
  onOpenImport: () => void;
}

const builtInThemes = [
  { id: 'default', name: 'Default', description: 'Original dark theme with purple/gray', isBuiltIn: true },
  { id: 'ocean-blue', name: 'Ocean Blue', description: 'Cool blue theme', isBuiltIn: true },
  { id: 'sunset-orange', name: 'Sunset Orange', description: 'Warm orange theme', isBuiltIn: true },
  { id: 'jade-green', name: 'Jade Green', description: 'Natural green theme', isBuiltIn: true },
  { id: 'dark-high-contrast', name: 'Dark High Contrast', description: 'High contrast black/white/bright', isBuiltIn: true },
  { id: 'black-white', name: 'Black & White', description: 'Pure black and white with 3px borders', isBuiltIn: true }
];

const ThemeModal: React.FC<ThemeModalProps> = ({ open, onClose, onSelectTheme, currentTheme, onOpenImport }) => {
  const { t } = useLanguage();
  const [customThemes, setCustomThemes] = useState<CustomTheme[]>([]);

  useEffect(() => {
    if (open) {
      setCustomThemes(getCustomThemes());
    }
  }, [open]);

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(t('modals.theme.delete_confirm'))) {
      deleteCustomTheme(id);
      setCustomThemes(getCustomThemes());
    }
  };

  const handleDownloadTemplate = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Fetch the default theme content from the public directory
    let defaultThemeCss = '';
    try {
      const response = await fetch('/themes/default.css');
      if (response.ok) {
        defaultThemeCss = await response.text();
      } else {
        throw new Error('Failed to fetch default theme');
      }
    } catch (err) {
      console.error('Failed to load default theme template:', err);
      // Fallback or alert if needed
      defaultThemeCss = '/* Default theme not found */';
    }

    // Check if running in Tauri
    const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;

    if (isTauri) {
      try {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const { writeTextFile } = await import('@tauri-apps/plugin-fs');

        const filePath = await save({
          defaultPath: 'easyeditor_template_theme.css',
          filters: [{
            name: 'CSS',
            extensions: ['css']
          }]
        });

        if (filePath) {
          await writeTextFile(filePath, defaultThemeCss);
          alert('Template saved successfully!');
        }
      } catch (err) {
        console.error('Failed to save file via Tauri:', err);
        alert('Failed to save template file.');
      }
    } else {
      // Web fallback
      const blob = new Blob([defaultThemeCss], { type: 'text/css' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'easyeditor_template_theme.css';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  if (!open) return null;

  const allThemes = [...builtInThemes, ...customThemes.map(t => ({ ...t, isBuiltIn: false }))];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content theme-modal" onClick={(e) => e.stopPropagation()}>
        <button className="theme-close" onClick={onClose}>✕</button>

        <div className="theme-hero">
          <div className="theme-hero-icon">
            <FaPalette size={48} />
          </div>
          <div>
            <h2 className="theme-title">{t('modals.theme.title')}</h2>
            <p className="theme-subtitle">{t('modals.theme.subtitle')}</p>
          </div>
        </div>

        <div className="theme-actions">
          <button className="btn-import" onClick={() => { onOpenImport(); onClose(); }}>
            <FaPlus /> {t('modals.theme.import')}
          </button>
        </div>

        <div className="theme-grid">
          {allThemes.map((theme) => (
            <button
              key={theme.id}
              className={`theme-card ${currentTheme === theme.id ? 'theme-active' : ''}`}
              onClick={() => {
                onSelectTheme(theme.id, !theme.isBuiltIn);
                onClose();
              }}
              style={{ position: 'relative' }}
            >
              <div className="theme-card-header">
                <h3>{theme.name}</h3>
                <div className="theme-badges">
                  {currentTheme === theme.id && <span className="theme-badge">{t('modals.theme.active')}</span>}
                  {theme.id === 'default' && (
                    <div
                      className="theme-badge"
                      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', background: '#4a5568' }}
                      onClick={handleDownloadTemplate}
                      title="Download Theme Template"
                    >
                      <FaDownload size={10} /> Template
                    </div>
                  )}
                  {!theme.isBuiltIn && (
                    <button
                      className="theme-delete"
                      onClick={(e) => handleDelete(theme.id, e)}
                      title={t('modals.theme.delete_tooltip')}
                    >
                      <FaTrash />
                    </button>
                  )}
                </div>
              </div>
              <p className="theme-card-desc">{theme.description}</p>
            </button>
          ))}
        </div>

        <div className="modal-actions">
          <button className="btn primary" onClick={onClose}>{t('actions.close')}</button>
        </div>
      </div>
    </div>
  );
};

export default ThemeModal;
