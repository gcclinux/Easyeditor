import React, { useState } from 'react';
import { FaGlobe, FaPlus, FaDownload } from 'react-icons/fa';
import { useLanguage } from '../i18n/LanguageContext';
import enTranslations from '../i18n/locales/en.json'; // Import English as template
import useEscapeKey from '../utils/useEscapeKey';
import './themeModal.css'; // Reuse theme modal styles for consistency

interface LanguageModalProps {
    open: boolean;
    onClose: () => void;
}

const LanguageModal: React.FC<LanguageModalProps> = ({ open, onClose }) => {
    const { language, setLanguage, availableLanguages, t, importLanguage } = useLanguage();
    const [importMode, setImportMode] = useState(false);
    const [importCode, setImportCode] = useState('');
    const [importName, setImportName] = useState('');
    const [importJson, setImportJson] = useState('');

    useEscapeKey(onClose, open);

    if (!open) return null;

    const handleImport = () => {
        try {
            const parsed = JSON.parse(importJson);
            importLanguage(importCode, importName, parsed);
            setImportMode(false);
            setImportCode('');
            setImportName('');
            setImportJson('');
        } catch (e) {
            alert(t('language_modal.invalid_json'));
        }
    }

    const handleDownloadTemplate = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent selecting the language
        const jsonString = JSON.stringify(enTranslations, null, 4);

        // Check if running in Tauri
        const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__;

        if (isTauri) {
            try {
                // Dynamic import for Tauri APIs
                const { save } = await import('@tauri-apps/plugin-dialog');
                const { writeTextFile } = await import('@tauri-apps/plugin-fs');

                const filePath = await save({
                    defaultPath: 'easyeditor_template_en.json',
                    filters: [{
                        name: 'JSON',
                        extensions: ['json']
                    }]
                });

                if (filePath) {
                    await writeTextFile(filePath, jsonString);
                    // access t via LanguageContext, assuming it's available or use alert fallback
                    alert('Template saved successfully!');
                }
            } catch (err) {
                console.error('Failed to save file via Tauri:', err);
                alert('Failed to save template file.');
            }
        } else {
            // Web fallback
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'easyeditor_template_en.json';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    };

    if (importMode) {
        return (
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal-content theme-modal" onClick={(e) => e.stopPropagation()}>
                    <button className="theme-close" onClick={() => setImportMode(false)}>✕</button>
                    <div className="theme-hero">
                        <div className="theme-hero-icon"><FaGlobe size={48} /></div>
                        <div>
                            <h2 className="theme-title">{t('language_modal.import_title')}</h2>
                            <p className="theme-subtitle">{t('language_modal.import_subtitle')}</p>
                        </div>
                    </div>
                    <div className="import-form" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <input placeholder={t('language_modal.placeholder_code')} value={importCode} onChange={e => setImportCode(e.target.value)} className="modal-input" style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', background: '#222', color: 'white' }} />
                        <input placeholder={t('language_modal.placeholder_name')} value={importName} onChange={e => setImportName(e.target.value)} className="modal-input" style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', background: '#222', color: 'white' }} />
                        <textarea placeholder={t('language_modal.placeholder_json')} value={importJson} onChange={e => setImportJson(e.target.value)} style={{ height: '200px', padding: '8px', borderRadius: '4px', border: '1px solid #444', background: '#222', color: 'white' }} />
                    </div>
                    <div className="modal-actions">
                        <button className="btn" onClick={() => setImportMode(false)}>{t('language_modal.cancel')}</button>
                        <button className="btn primary" onClick={handleImport} disabled={!importCode || !importName || !importJson}>{t('language_modal.import')}</button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content theme-modal" onClick={(e) => e.stopPropagation()}>
                <button className="theme-close" onClick={onClose}>✕</button>

                <div className="theme-hero">
                    <div className="theme-hero-icon">
                        <FaGlobe size={48} />
                    </div>
                    <div>
                        <h2 className="theme-title">{t('menu.select_language')}</h2>
                        <p className="theme-subtitle">{t('language_modal.subtitle')}</p>
                    </div>
                </div>

                <div className="theme-actions">
                    <button className="btn-import" onClick={() => setImportMode(true)}>
                        <FaPlus /> {t('language_modal.import_button')}
                    </button>
                </div>

                <div className="theme-grid">
                    {availableLanguages.map((lang) => (
                        <button
                            key={lang.code}
                            className={`theme-card ${language === lang.code ? 'theme-active' : ''}`}
                            onClick={() => {
                                setLanguage(lang.code);
                                onClose();
                            }}
                            style={{ position: 'relative' }}
                        >
                            <div className="theme-card-header">
                                <h3>{lang.label}</h3>
                                <div className="theme-badges">
                                    {language === lang.code && <span className="theme-badge">{t('language_modal.active')}</span>}
                                    {lang.code === 'en' && (
                                        <div
                                            className="theme-badge"
                                            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', background: '#4a5568' }}
                                            onClick={handleDownloadTemplate}
                                            title="Download English Template"
                                        >
                                            <FaDownload size={10} /> Template
                                        </div>
                                    )}
                                </div>
                            </div>
                            <p className="theme-card-desc">{lang.name}</p>
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

export default LanguageModal;
