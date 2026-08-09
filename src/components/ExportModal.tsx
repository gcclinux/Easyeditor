import React from 'react';
import { FaDownload, FaFilePdf, FaFileAlt, FaLock, FaCloud, FaTimes, FaImage, FaGoogleDrive, FaDropbox, FaSave } from 'react-icons/fa';
import { useLanguage } from '../i18n/LanguageContext';
import './exportModal.css';

type Props = {
    onSave?: () => void;
    onSaveAs?: () => void;
    onSaveAsPNG: () => void;
    onSaveAsPDF: () => void;
    onSaveToMarkdown: () => void;
    onSaveToTXT: () => void;
    onSaveEncrypted: () => void;
    onExportToCloud: (providerName: string) => void;
    connectedProviders: { name: string; displayName: string; icon?: string }[];
    onClose: () => void;
};

export default function ExportModal({
    onSave,
    onSaveAs,
    onSaveAsPNG,
    onSaveAsPDF,
    onSaveToMarkdown,
    onSaveToTXT,
    onSaveEncrypted,
    onExportToCloud,
    connectedProviders,
    onClose
}: Props) {
    const { t } = useLanguage();

    const renderTile = (
        icon: React.ReactNode,
        title: string,
        desc: string,
        onClick?: () => void
    ) => {
        if (!onClick) return null;
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
                <div className="export-tile-title">{title}</div>
                <div className="export-tile-desc">{desc}</div>
            </button>
        );
    };

    const getProviderIcon = (name: string) => {
        switch (name) {
            case 'googledrive': return <FaGoogleDrive />;
            case 'dropbox': return <FaDropbox />;
            default: return <FaCloud />;
        }
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
                        {renderTile(<FaSave />, t('menu.save'), t('menu.save_desc'), onSave)}
                        {renderTile(<FaSave />, t('menu.save_as'), t('menu.save_as_desc'), onSaveAs)}
                        {renderTile(<FaFileAlt />, t('exports.markdown'), t('exports.markdown_desc'), onSaveToMarkdown)}
                        {renderTile(<FaFileAlt />, t('exports.txt'), t('exports.txt_desc'), onSaveToTXT)}
                        {renderTile(<FaImage />, t('exports.png'), t('exports.png_desc'), onSaveAsPNG)}
                        {renderTile(<FaFilePdf />, t('exports.pdf'), t('exports.pdf_desc'), onSaveAsPDF)}
                        {renderTile(<FaLock />, t('exports.encrypted'), t('exports.encrypted_desc'), onSaveEncrypted)}
                    </div>
                </div>

                {connectedProviders.length > 0 && (
                    <div className="export-tiles-section">
                        <div className="export-tiles-section-title">{t('exports.cloud')}</div>
                        <div className="export-tiles-grid">
                            {connectedProviders.map(provider => (
                                <React.Fragment key={provider.name}>
                                    {renderTile(
                                        getProviderIcon(provider.name),
                                        provider.displayName,
                                        t('exports.cloud_desc'),
                                        () => onExportToCloud(provider.name)
                                    )}
                                </React.Fragment>
                            ))}
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
