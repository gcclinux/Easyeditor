import React from 'react';
import {
    FaLink,
    FaTimes
} from 'react-icons/fa';
import { useLanguage } from '../i18n/LanguageContext';
import './linksModal.css';

type Props = {
    onInsertTemplate: (tpl: string) => void;
    onClose: () => void;
};

export default function LinksModal({ onInsertTemplate, onClose }: Props) {
    const { t } = useLanguage();

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content links-modal" onClick={(e) => e.stopPropagation()}>
                <h2>
                    <FaLink /> {t('toolbar.links')}
                </h2>

                <div className="links-tiles-section">
                    <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                        {t('toolbar.links')} moved to {t('toolbar.insert')} modal.
                    </p>
                </div>

                <div className="modal-actions">
                    <button className="modal-button cancel-button" onClick={onClose}>
                        <FaTimes /> {t('actions.close')}
                    </button>
                </div>
            </div>
        </div>
    );
}
