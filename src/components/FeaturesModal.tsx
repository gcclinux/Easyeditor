import './featuresModal.css';
import { createPortal } from 'react-dom';
import { useLanguage } from '../i18n/LanguageContext';
import icon from '../assets/logo.png';

interface FeaturesModalProps {
  open: boolean;
  onClose: () => void;
}

export function FeaturesModal({ open, onClose }: FeaturesModalProps) {
  const { t } = useLanguage();

  if (!open) return null;

  const content = (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="features-title">
      <div className="modal-content features-modal">
        <div className="features-hero">
          <div className="features-hero-logo">
            <img src={icon} alt="EasyEditor" />
          </div>
          <div className="features-hero-text">
            <h2 id="features-title" className="features-title">{t('features_modal.title')}</h2>
            <div className="features-subtitle">{t('features_modal.subtitle')}</div>
          </div>
        </div>
        <button className="icon-btn about-close" aria-label={t('features_modal.close_button_label')} title={t('features_modal.close_text')} onClick={onClose}>✕</button>
        <div className="features-grid">
          <div className="feature-card">
            <h3>{t('features_modal.cards.templates.title')}</h3>
            <p>{t('features_modal.cards.templates.desc')}</p>
          </div>
          <div className="feature-card">
            <h3>{t('features_modal.cards.formatting.title')}</h3>
            <p>{t('features_modal.cards.formatting.desc')}</p>
          </div>
          <div className="feature-card">
            <h3>{t('features_modal.cards.tables_media.title')}</h3>
            <p>{t('features_modal.cards.tables_media.desc')}</p>
          </div>
          <div className="feature-card">
            <h3>{t('features_modal.cards.diagrams.title')}</h3>
            <p>{t('features_modal.cards.diagrams.desc')}</p>
          </div>
          <div className="feature-card">
            <h3>{t('features_modal.cards.export_security.title')}</h3>
            <p>{t('features_modal.cards.export_security.desc')}</p>
          </div>
          <div className="feature-card">
            <h3>{t('features_modal.cards.layout.title')}</h3>
            <p>{t('features_modal.cards.layout.desc')}</p>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn primary" onClick={onClose}>{t('features_modal.close_text')}</button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

export default FeaturesModal;
