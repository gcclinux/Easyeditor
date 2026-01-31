import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../i18n/LanguageContext';
import './aboutModal.css'; // Reusing styles

interface UpdateModalProps {
    open: boolean;
    onClose: () => void;
    runVersion: string;
    availVersion: string;
}

export function UpdateModal({ open, onClose, runVersion, availVersion }: UpdateModalProps) {
    const { t } = useLanguage();

    if (!open) return null;

    const content = (
        <div className="modal-overlay" role="dialog" aria-modal="true">
            <div className="modal-content about-modal" style={{ maxWidth: '400px', padding: '20px' }}>
                <button className="icon-btn about-close" aria-label={t('actions.close')} title={t('actions.close')} onClick={onClose}>✕</button>
                <div className="about-card" style={{ textAlign: 'center' }}>
                    <h3>{t('modals.update.title')}</h3>
                    <p>{t('modals.update.subtitle')}</p>
                    <div style={{ margin: '20px 0', textAlign: 'left', display: 'inline-block' }}>
                        <div>{t('modals.update.running_version')}: <strong>{runVersion}</strong></div>
                        <div>{t('modals.update.available_version')}: <strong>{availVersion}</strong></div>
                    </div>
                    <br />
                    <a href="https://github.com/gcclinux/Easyeditor/releases/latest"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn primary"
                        style={{ textDecoration: 'none', display: 'inline-block', marginTop: '10px' }}>
                        {t('modals.update.download')}
                    </a>
                    <br />
                    <button className="btn secondary" onClick={onClose} style={{ marginTop: '10px' }}>
                        {t('modals.update.close')}
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(content, document.body);
}

export default UpdateModal;
