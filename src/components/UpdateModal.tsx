import { createPortal } from 'react-dom';
import { useLanguage } from '../i18n/LanguageContext';
import './aboutModal.css';

interface UpdateModalProps {
    open: boolean;
    onClose: () => void;
    runVersion: string;
    availVersion: string;
    releaseDate?: string;
}

export function UpdateModal({ open, onClose, runVersion, availVersion, releaseDate }: UpdateModalProps) {
    const { t } = useLanguage();

    if (!open) return null;

    const handleDownload = async () => {
        const url = 'https://github.com/gcclinux/Easyeditor/releases/latest';

        // Check if running inside Tauri context
        if ((window as any).__TAURI_INTERNALS__) {
            try {
                const { open: openShell } = await import('@tauri-apps/plugin-shell');
                await openShell(url);
            } catch (err) {
                console.error('[UpdateModal] Failed to open URL via Tauri shell plugin:', err);
                window.open(url, '_blank');
            }

            try {
                const { getCurrentWindow } = await import('@tauri-apps/api/window');
                await getCurrentWindow().close();
            } catch (err) {
                console.error('[UpdateModal] Failed to close Tauri window:', err);
                window.close();
            }
        } else {
            window.open(url, '_blank');
            window.close();
        }
    };

    const content = (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="update-title">
            <div className="modal-content about-modal" style={{ maxWidth: '440px', padding: '24px' }}>
                <button
                    className="icon-btn about-close"
                    aria-label={t('actions.close')}
                    title={t('actions.close')}
                    onClick={onClose}
                >
                    ✕
                </button>
                <div className="about-card" style={{ textAlign: 'center' }}>
                    <h3 id="update-title" style={{ marginTop: 0, marginBottom: '12px' }}>
                        {t('modals.update.title', 'Update Available')}
                    </h3>
                    <p style={{ marginBottom: '16px', color: 'var(--text-muted, #aaa)' }}>
                        {t('modals.update.subtitle', 'A new version of EasyEditor is available!')}
                    </p>
                    <div style={{
                        margin: '16px 0',
                        padding: '12px 16px',
                        background: 'var(--bg-card, rgba(255,255,255,0.05))',
                        borderRadius: '8px',
                        textAlign: 'left',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        fontSize: '0.95em'
                    }}>
                        <div>
                            {t('about.running_version', 'Running Version:')} <strong>{runVersion}</strong>
                        </div>
                        <div>
                            {t('about.available_version', 'Available Version:')} <strong>{availVersion}</strong>
                        </div>
                        {releaseDate && (
                            <div style={{ fontSize: '0.85em', color: 'var(--text-muted, #aaa)', marginTop: '4px' }}>
                                {t('modals.update.release_date', 'Build Date')}: {releaseDate}
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '20px' }}>
                        <button
                            className="btn primary"
                            onClick={handleDownload}
                        >
                            {t('modals.update.download', 'Download')}
                        </button>
                        <button
                            className="btn secondary"
                            onClick={onClose}
                        >
                            {t('actions.continue', 'Continue')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(content, document.body);
}

export default UpdateModal;
