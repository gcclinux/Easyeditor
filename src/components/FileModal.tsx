import React from 'react';
import { FaFileImport, FaSave, FaStar, FaGithub, FaHeart, FaPalette, FaGlobe, FaInfoCircle, FaTimes, FaFileAlt, FaLeaf } from 'react-icons/fa';
import { BsFileEarmarkLockFill } from "react-icons/bs";
import { useLanguage } from '../i18n/LanguageContext';
import './fileModal.css';

type Props = {
    onOpenMarkdown: () => void;
    onOpenTxt: () => void;
    onOpenEncrypted: () => void;
    onSave: () => void;
    onSaveAs: () => void;
    onFeatures: () => void;
    onSupport: () => void;
    onBuyCoffee: () => void;
    onSelectTheme: () => void;
    onSelectLanguage: () => void;
    onAbout: () => void;
    onClose: () => void;
};

export default function FileModal({
    onOpenMarkdown,
    onOpenTxt,
    onOpenEncrypted,
    onSave,
    onSaveAs,
    onFeatures,
    onSupport,
    onBuyCoffee,
    onSelectTheme,
    onSelectLanguage,
    onAbout,
    onClose
}: Props) {
    const { t } = useLanguage();

    const renderTile = (
        icon: React.ReactNode,
        titleKey: string,
        descKey: string,
        onClick: () => void
    ) => {
        return (
            <button
                className="file-tile"
                onClick={() => {
                    onClick();
                    onClose();
                }}
            >
                <div className="file-tile-icon">
                    {icon}
                </div>
                <div className="file-tile-title">{t(titleKey)}</div>
                <div className="file-tile-desc">{t(descKey)}</div>
            </button>
        );
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content file-modal" onClick={(e) => e.stopPropagation()}>
                <h2>
                    <FaFileImport /> {t('menu.file')}
                </h2>
                <p className="file-modal-subtitle">{t('menu.file_operations_settings')}</p>

                {/* File Operations */}
                <div className="file-tiles-section">
                    <div className="file-tiles-section-title">{t('menu.open_save')}</div>
                    <div className="file-tiles-grid">
                        {renderTile(<FaFileImport />, 'menu.open_markdown', 'menu.open_markdown_desc', onOpenMarkdown)}
                        {renderTile(<FaFileAlt />, 'menu.open_txt', 'menu.open_txt_desc', onOpenTxt)}
                        {renderTile(<BsFileEarmarkLockFill />, 'menu.open_encrypted', 'menu.open_encrypted_desc', onOpenEncrypted)}
                        {renderTile(<FaSave />, 'menu.save', 'menu.save_desc', onSave)}
                        {renderTile(<FaSave />, 'menu.save_as', 'menu.save_as_desc', onSaveAs)}
                    </div>
                </div>

                {/* Settings & Info */}
                <div className="file-tiles-section">
                    <div className="file-tiles-section-title">{t('menu.settings_app')}</div>
                    <div className="file-tiles-grid">
                        {renderTile(<FaPalette />, 'menu.select_theme', 'menu.choose_theme', onSelectTheme)}
                        {renderTile(<FaGlobe />, 'menu.select_language', 'menu.choose_language', onSelectLanguage)}
                        {renderTile(<FaStar />, 'menu.features', 'menu.features_desc', onFeatures)}
                        {renderTile(<FaInfoCircle />, 'menu.about', 'menu.version_info', onAbout)}
                    </div>
                </div>

                {/* Support */}
                <div className="file-tiles-section">
                    <div className="file-tiles-section-title">{t('menu.community_support')}</div>
                    <div className="file-tiles-grid">
                        {renderTile(<FaGithub />, 'menu.support', 'menu.support_desc', onSupport)}
                        {renderTile(<FaHeart />, 'menu.buy_coffee', 'menu.sponsor', onBuyCoffee)}
                        {renderTile(<FaGlobe />, 'menu.website', 'menu.website_desc', async () => {
                            const url = 'https://easyeditor.co.uk';
                            const isTauri = typeof window !== 'undefined' &&
                                ((window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__ ||
                                    typeof (window as any).__TAURI_INVOKE__ === 'function');

                            if (isTauri) {
                                try {
                                    const { open } = await import('@tauri-apps/plugin-shell');
                                    await open(url);
                                } catch (e) {
                                    console.error('Tauri shell open failed:', e);
                                    window.open(url, '_blank');
                                }
                            } else {
                                window.open(url, '_blank');
                            }
                        })}
                        {renderTile(<FaLeaf />, 'menu.climate', 'about.premium_features_li6', async () => {
                            const url = 'https://climate.stripe.com/cVP4Y7';
                            const isTauri = typeof window !== 'undefined' &&
                                ((window as any).__TAURI__ || (window as any).__TAURI_INTERNALS__ ||
                                    typeof (window as any).__TAURI_INVOKE__ === 'function');

                            if (isTauri) {
                                try {
                                    const { open } = await import('@tauri-apps/plugin-shell');
                                    await open(url);
                                } catch (e) {
                                    console.error('Tauri shell open failed:', e);
                                    window.open(url, '_blank');
                                }
                            } else {
                                window.open(url, '_blank');
                            }
                        })}
                    </div>
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
