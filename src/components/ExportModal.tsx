import React from 'react';
import { FaDownload, FaFilePdf, FaFileAlt, FaLock, FaCloud, FaTimes, FaImage } from 'react-icons/fa';
import { useLanguage } from '../i18n/LanguageContext';
import './exportModal.css';

type Props = {
    onSaveAsPNG: () => void;
    onSaveAsPDF: () => void;
    onSaveToMarkdown: () => void;
    onSaveToTXT: () => void;
    onSaveEncrypted: () => void;
    onSaveToCloud: () => void;
    currentCloudNote: { providerDisplayName: string } | null;
    onClose: () => void;
};

export default function ExportModal({
    onSaveAsPNG,
    onSaveAsPDF,
    onSaveToMarkdown,
    onSaveToTXT,
    onSaveEncrypted,
    onSaveToCloud,
    currentCloudNote,
    onClose
}: Props) {
    const { t } = useLanguage();

    const renderTile = (
        icon: React.ReactNode,
        titleKey: string,
        descKey: string,
        onClick: () => void,
        dynamicDesc?: string
    ) => {
        return (
            <button
                className="export-tile"
                onClick={() => {
                    onClick();
                    onClose();
                }}
            >
                <div className="export-tile-icon">
                    {icon}
                </div>
                <div className="export-tile-title">{t(titleKey)}</div>
                <div className="export-tile-desc">{t(descKey)} {dynamicDesc}</div>
            </button>
        );
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content export-modal" onClick={(e) => e.stopPropagation()}>
                <h2>
                    <FaDownload /> {t('menu.exports')}
                </h2>
                <p className="export-modal-subtitle">{t('modals.exports.subtitle')}</p>

                <div className="export-tiles-section">
                    <div className="export-tiles-section-title">{t('modals.exports.section_title')}</div>
                    <div className="export-tiles-grid">
                        {renderTile(<FaImage />, 'exports.png', 'exports.png_desc', onSaveAsPNG)}
                        {renderTile(<FaFilePdf />, 'exports.pdf', 'exports.pdf_desc', onSaveAsPDF)}
                        {renderTile(<FaFileAlt />, 'exports.markdown', 'exports.markdown_desc', onSaveToMarkdown)}
                        {renderTile(<FaFileAlt />, 'exports.txt', 'exports.txt_desc', onSaveToTXT)}
                        {renderTile(<FaLock />, 'exports.encrypted', 'exports.encrypted_desc', onSaveEncrypted)}
                    </div>
                </div>

                {currentCloudNote && (
                    <div className="export-tiles-section">
                        <div className="export-tiles-section-title">{t('exports.cloud')}</div>
                        <div className="export-tiles-grid">
                            {renderTile(
                                <FaCloud />,
                                'exports.cloud',
                                'exports.cloud_desc',
                                onSaveToCloud,
                                currentCloudNote.providerDisplayName
                            )}
                        </div>
                    </div>
                )}

                <div className="modal-actions">
                    <button className="modal-button cancel-button" onClick={onClose}>
                        <FaTimes /> {t('actions.close')}
                    </button>
                </div>
            </div>
        </div>
    );
}
