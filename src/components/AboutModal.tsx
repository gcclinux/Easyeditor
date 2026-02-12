import React from 'react';
import './aboutModal.css';
import { createPortal } from 'react-dom';
import logo from '../assets/128x128@2x.png';
import { useLanguage } from '../i18n/LanguageContext';
import LicenseManager from '../premium/LicenseManager';

import { getRunningVersion, getAvailableVersion, compareVersions } from '../utils/version';

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
}

export function AboutModal({ open, onClose }: AboutModalProps) {
  const { t } = useLanguage();

  const [lastUpdated, setLastUpdated] = React.useState<string>('Sun Dec 7 2025');
  const [version, setVersion] = React.useState<string>('');
  const [availableVersion, setAvailableVersion] = React.useState<string>('');
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [plan, setPlan] = React.useState('');
  const [isLicenseValid, setIsLicenseValid] = React.useState(false);

  React.useEffect(() => {
    const storedEmail = LicenseManager.getStoredEmail();
    if (storedEmail) setEmail(storedEmail);
    const storedPlan = LicenseManager.getStoredPlan();
    if (storedPlan) setPlan(storedPlan);
    const storedName = localStorage.getItem('easyeditor-user-name');
    if (storedName) setName(storedName);

    // Check initial license state
    if (LicenseManager.hasActiveLicense()) {
      setIsLicenseValid(true);
    }

    // Subscribe to license changes to update plan
    const unsubscribe = LicenseManager.subscribe(() => {
      setIsLicenseValid(LicenseManager.hasActiveLicense());
      const updatedPlan = LicenseManager.getPlan();
      setPlan(updatedPlan);
    });

    return () => unsubscribe();
  }, []);

  const handleSaveLicense = async () => {
    localStorage.setItem('easyeditor-user-name', name);
    await LicenseManager.setLicenseData(email);
    setIsLicenseValid(LicenseManager.hasActiveLicense());
    setPlan(LicenseManager.getPlan());
  };

  React.useEffect(() => {
    (async () => {
      const v = await getRunningVersion();
      setVersion(v);

      const avInfo = await getAvailableVersion();
      setAvailableVersion(avInfo.version);
      if (avInfo.date) {
        setLastUpdated(avInfo.date);
      }
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
              <span className="badge">{t('about.badge_export')}</span>
              <span className="badge">{t('about.badge_hosted')}</span>
              <span className="badge">{t('about.badge_git')}</span>
              <span className="badge">{t('about.badge_cloud')}</span>
              <a href="https://easyeditor.co.uk/" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                <span className="badge">{t('about.badge_roadmap')}</span>
              </a>
            </div>
          </div>
        </div>
        <button className="icon-btn about-close" aria-label={t('actions.close')} title={t('actions.close')} onClick={onClose}>✕</button>
        <div className="about-grid">
          <div className="about-card">
            <h3>{t('about.what_it_is')}</h3>
            <p>
              {t('about.what_it_is_desc')}
            </p>
            <p>
              {t('about.support')} <a href="https://github.com/gcclinux/EasyEditor/discussions" target="_blank" rel="noopener noreferrer">GitHub Discussions</a>
            </p>
          </div>
          <div className="about-card">
            <h3>{t('about.what_it_does')}</h3>
            <ul>
              <li>{t('about.what_it_does_li1')}</li>
              <li>{t('about.what_it_does_li2')}</li>
              <li>{t('about.what_it_does_li3')}</li>
              <li>{t('about.what_it_does_li4')}</li>
              <li>{t('about.what_it_does_li5')}</li>
            </ul>
          </div>
          <div className="about-card">
            <h3>{t('about.custom_themes')} & {t('about.why_like')}</h3>
            <p>
              {t('about.custom_themes_desc1')}
            </p>
            <p>{t('about.why_like_desc1')}</p>
          </div>
          <div className="about-card">
            <h3>{t('about.git_integration')} &nbsp; {t('about.native_languages')}</h3>
            <p>
              {t('about.git_integration_desc1')}&nbsp;{t('about.git_integration_desc2')}
              <br />
              {t('about.native_languages_desc')}
            </p>
          </div>
          <div className="about-card">
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <h3>{t('about.credits')}</h3>
                <p>{t('about.built_by')}<br />
                  <span className="muted">{t('about.last_updated')} {lastUpdated}</span>
                </p>
                <p>{t('about.license')} <a href="https://easyeditor.co.uk/license" target="_blank" rel="noopener noreferrer">Core - Open Source (MIT)</a><br />{t('about.running_version')} <strong>{version || '...'}</strong><br />{t('about.available_version')} <strong>{availableVersion || '...'}</strong>
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
                  <a href="https://plantuml.com/" target="_blank" rel="noopener noreferrer"><b>PlantUML</b></a> - {t('about.official_module')}
                </p>
              </div>
            </div>
          </div>
          <div className="about-card">
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <h3>{t('about.premium_features')}</h3>
                <ul style={{ paddingLeft: '20px', lineHeight: '1.6', fontSize: '0.9em' }}>
                  <li>{t('about.premium_features_li1')}</li>
                  <li>{t('about.premium_features_li2')}</li>
                  <li>{t('about.premium_features_li3')}</li>
                  <li>{t('about.premium_features_li4')}</li>
                  <li>{t('about.premium_features_li5')}</li>
                  <li>
                    <a href="https://climate.stripe.com/cVP4Y7" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                      {t('about.premium_features_li6')} <span style={{ fontSize: '0.8em' }}>↗</span>
                    </a>
                  </li>
                </ul>
                <a
                  href="https://www.easyeditor.co.uk/#pricing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn secondary"
                  style={{ marginTop: '5px', padding: '6px 12px', display: 'inline-block', textDecoration: 'none' }}
                >
                  View Pricing
                </a>
              </div>
              <div style={{ flex: 1, borderLeft: '1px solid var(--border-color, #eee)', paddingLeft: '1rem' }}>
                <h3>{t('about.license_info')} ({isLicenseValid ? t('about.license_premium') : t('about.license_free')})</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.9em', marginBottom: '4px' }}>{t('about.license_name')}</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="license-name-input"
                      style={{ width: '95%', padding: '4px', borderRadius: '4px', border: '1px solid #ccc', color: 'red !important' }}
                      placeholder={t('about.license_name_placeholder')}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.9em', marginBottom: '4px' }}>{t('about.license_email')}</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="license-email-input"
                      style={{ width: '95%', padding: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
                      placeholder={t('about.license_email_placeholder')}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.9em', marginBottom: '4px' }}>{t('about.subscription_type')}</label>
                    <input
                      type="text"
                      value={plan}
                      readOnly
                      className="license-plan-input"
                      style={{ width: '95%', padding: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
                      placeholder={t('about.subscription_type_placeholder')}
                    />
                  </div>
                  <button
                    onClick={handleSaveLicense}
                    className="btn secondary"
                    style={{ marginTop: '5px', alignSelf: 'flex-start', padding: '6px 12px' }}
                  >
                    {t('about.check_license')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn primary" onClick={onClose}>{t('about.close')}</button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

export default AboutModal;
