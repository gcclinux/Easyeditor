import React, { useState, useEffect } from 'react';
import './importMDModal.css';
import { useLanguage } from '../i18n/LanguageContext';

interface ImportMDModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (url: string) => void;
}

const ImportMDModal: React.FC<ImportMDModalProps> = ({ open, onClose, onSubmit }) => {
    const { t } = useLanguage();
    const [url, setUrl] = useState('');

    useEffect(() => {
        if (open) {
            setUrl('');
        }
    }, [open]);

    if (!open) {
        return null;
    }

    const isValid = !!url.trim();

    const handleSubmit = () => {
        if (!isValid) {
            return;
        }
        onSubmit(url.trim());
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            handleSubmit();
        }
    };

    return (
        <div className="modal-overlay">
            <div className="modal-content import-md-modal">
                <h2>{t('modals.import_md.title') || 'Import Markdown'}</h2>
                <p>{t('modals.import_md.subtitle') || 'Enter the URL of the Markdown file you want to import.'}</p>

                <div className="input-group">
                    <label htmlFor="md-url">{t('modals.import_md.url_label') || 'Document'}</label>
                    <input
                        id="md-url"
                        type="text"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={t('modals.import_md.url_placeholder') || 'https://example.com/file.md'}
                        autoFocus
                    />
                </div>

                <div className="modal-actions">
                    <button onClick={onClose} className="modal-button cancel-button">{t('modals.import_md.cancel') || 'Cancel'}</button>
                    <button
                        onClick={handleSubmit}
                        className={`modal-button submit-button ${isValid ? 'active' : 'disabled'}`}
                        disabled={!isValid}
                    >
                        {t('modals.import_md.import') || 'Import'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ImportMDModal;
