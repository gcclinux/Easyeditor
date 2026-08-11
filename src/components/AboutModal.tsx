import React from 'react';
import './aboutModal.css';
import { createPortal } from 'react-dom';
import logo from '../assets/128x128@2x.png';
import { useLanguage } from '../i18n/LanguageContext';
import { hasAnalyticsConsent, setAnalyticsConsent } from '../services/analytics';

import { getRunningVersion, getAvailableVersion, compareVersions } from '../utils/version';

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
}

export function AboutModal({ open, onClose }: AboutModalProps) {
  const { t } = useLanguage();

  const [version, setVersion] = React.useState<string>('');
  const [availableVersion, setAvailableVersion] = React.useState<string>('');
  const [analyticsEnabled, setAnalyticsEnabled] = React.useState<boolean>(hasAnalyticsConsent());
  React.useEffect(() => {
    (async () => {
      const v = await getRunningVersion();
      setVersion(v);

      const avInfo = await getAvailableVersion();
      setAvailableVersion(avInfo.version);
    })();
  }, []);
  if (!open) return null;

  const content = (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="about-title">
      <div className="modal-content about-modal">
        <div className="about-hero">
          <div className="about-hero-logo">
            <a href="https://www.easyeditor.co.uk/" target="_blank" rel="noopener noreferrer">
              <img src={logo} alt="EasyEditor" />
            </a>
          </div>
          <div className="about-hero-text">
            <h2 id="about-title" className="about-title">{t('about.title')}</h2>
            <div className="about-subtitle">{t('about.subtitle')}</div>
            <div className="about-badges">
              <span className="badge">{t('about.badge_markdown')}</span>
              <span className="badge">{t('about.badge_templates')}</span>
              <span className="badge">{t('about.badge_mermaid')}</span>
              <span className="badge">{t('about.badge_import_docx')}</span>
              <span className="badge">{t('about.badge_export')}</span>
              <span className="badge">{t('about.badge_easygit')}</span>
              <span className="badge">{t('about.badge_easynotes')}</span>
              <span className="badge">{t('about.badge_easyai')}</span>
              <a href="https://easysmartapps.co.uk/" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                <span className="badge">{t('about.badge_roadmap')}</span>
              </a>
            </div>
          </div>
        </div>
        <div className="about-grid">
          {/* Left Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="about-card">
              <h3>{t('about.what_it_is')}</h3>
              <p>
                {t('about.what_it_is_desc')}
              </p>
            </div>
            <div className="about-card">
              <h3>{t('about.what_it_does')}</h3>
              <ul>
                <li>{t('about.what_it_does_li1')}</li>
                <li>{t('about.what_it_does_li3')}</li>
              </ul>
            </div>
            <div className="about-card">
              <h3>{t('about.custom_themes')}</h3>
              <p>
                {t('about.custom_themes_desc1')}
              </p>
            </div>
            <div className="about-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', gap: '1rem', flex: 1 }}>
                <div style={{ flex: 1 }}>
                  <h3>{t('about.credits')}</h3>
                  <p>
                    {t('about.built_by')}<br />
                    {t('about.license')} <a href="https://easyeditor.co.uk/license" target="_blank" rel="noopener noreferrer">GNU AGPLv3 with Commons Clause</a><br />{t('about.running_version')} <strong>{version || '...'}</strong><br />{t('about.available_version')} <strong>{availableVersion || '...'}</strong>
                    {version && availableVersion && compareVersions(version, availableVersion) < 0 && (
                      <>
                        <br />
                        Latest Version: <a href="https://github.com/gcclinux/Easyeditor/releases/latest" target="_blank" rel="noopener noreferrer">Download Latest</a>
                      </>
                    )}
                  </p>
                </div>
                <div style={{ flex: 1, borderLeft: '1px solid var(--border-color, #eee)', paddingLeft: '1rem' }}>
                  <h3>{t('about.powered_by')}</h3>
                  <p>
                    <a href="https://mermaid.js.org/" target="_blank" rel="noopener noreferrer"><b>Mermaid</b></a> - {t('about.official_module')}<br />
                    <a href="https://daringfireball.net/projects/markdown/" target="_blank" rel="noopener noreferrer"><b>Markdown</b></a> - {t('about.official_module')}<br />
                    <a href="https://plantuml.com/" target="_blank" rel="noopener noreferrer"><b>PlantUML</b></a> - {t('about.official_module')}<br />
                    <a href="https://katex.org/" target="_blank" rel="noopener noreferrer"><b>KaTeX</b></a> - {t('about.official_module')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="about-card">
              <h3>{t('about.git_integration')}</h3>
              <div style={{ lineHeight: '1.6', fontSize: '0.95em' }}>
                <p style={{ marginBottom: '10px' }}>
                  {t('about.git_integration_desc1')}
                </p>
                <p>
                  {t('about.git_integration_desc2')}
                </p>
              </div>
            </div>
            <div className="about-card">
              <h3>{t('about.cloud_integration_title')}</h3>
              <div style={{ lineHeight: '1.6', fontSize: '0.95em' }}>
                <p dangerouslySetInnerHTML={{ __html: t('about.cloud_integration_desc') }} />
              </div>
            </div>
            <div className="about-card" style={{ flex: 1 }}>
              <h3>{t('about.premium_features')}</h3>
              <div style={{ lineHeight: '1.6', fontSize: '0.95em' }}>
                <p style={{ marginBottom: '10px' }} dangerouslySetInnerHTML={{ __html: t('about.premium_features_desc2') }} />
                <p style={{ marginBottom: '10px' }} dangerouslySetInnerHTML={{ __html: t('about.premium_features_desc3') }} />
                <p dangerouslySetInnerHTML={{ __html: t('about.premium_features_desc4') }} />
              </div>
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginRight: 'auto' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9em', color: 'var(--text-secondary, #666)' }}>
              <input
                type="checkbox"
                checked={analyticsEnabled}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  setAnalyticsEnabled(enabled);
                  setAnalyticsConsent(enabled);
                }}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              {t('analytics.toggle_label')}
            </label>
            <span style={{ fontSize: '0.8em', color: 'var(--text-muted, #999)' }}>
              {t('analytics.toggle_description')}
            </span>
          </div>
          <button className="btn primary" onClick={onClose}>{t('about.close')}</button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

export default AboutModal;
