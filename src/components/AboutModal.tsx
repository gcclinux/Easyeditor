import React from 'react';
import './aboutModal.css';
import { createPortal } from 'react-dom';
import logo from '../assets/128x128@2x.png';
import { useLanguage } from '../i18n/LanguageContext';
import LicenseManager from '../premium/LicenseManager';

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
}

export function AboutModal({ open, onClose }: AboutModalProps) {
  const { t } = useLanguage();

  const lastUpdated = 'Sun Dec 7 2025';
  const [version, setVersion] = React.useState<string>('');
  const [availableVersion, setAvailableVersion] = React.useState<string>('');
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [purchaseDate, setPurchaseDate] = React.useState('');
  const [isLicenseValid, setIsLicenseValid] = React.useState(false);

  React.useEffect(() => {
    const storedEmail = LicenseManager.getStoredEmail();
    if (storedEmail) setEmail(storedEmail);
    const storedDate = LicenseManager.getStoredPurchaseDate();
    if (storedDate) setPurchaseDate(storedDate);
    const storedName = localStorage.getItem('easyeditor-user-name');
    if (storedName) setName(storedName);

    // Check initial license state
    if (LicenseManager.hasActiveLicense()) {
      setIsLicenseValid(true);
    }
  }, []);

  const handleSaveLicense = async () => {
    localStorage.setItem('easyeditor-user-name', name);
    await LicenseManager.setLicenseData(email, purchaseDate);
    setIsLicenseValid(LicenseManager.hasActiveLicense());
  };

  React.useEffect(() => {
    // Try common sources for app version: injected env, fetch package.json, else unknown
    try {
      const envVersion = (window as any)?.process?.env?.npm_package_version;
      if (envVersion) {
        setVersion(envVersion);
        return;
      }
    } catch (e) {
      // ignore
    }

    // Web-only version detection
    (async () => {

      // Try fetching package.json (works if app serves it) and also try to fetch
      // the latest available version info (local release/latest.json or remote fallback).

      try {
        const resp = await fetch('/package.json');
        if (resp.ok) {
          const pkg = await resp.json();
          setVersion(pkg.version || 'unknown');
        } else {
          setVersion('unknown');
        }
      } catch (e) {
        setVersion('unknown');
      }
      // get running version
      try {
        const resp = await fetch('/package.json');
        if (resp.ok) {
          const pkg = await resp.json();
          setVersion(pkg.version || 'unknown');
        } else {
          setVersion('unknown');
        }
      } catch (e) {
        setVersion('unknown');
      }

      // try local packaged latest.json first (some builds include this), then remote fallback
      try {
        // try a local path first
        let remoteVer = '';
        try {
          const localResp = await fetch('/release/latest.json');
          if (localResp.ok) {
            const localData = await localResp.json();
            remoteVer = localData.version || '';
          }
        } catch (e) {
          // ignore local fetch error and try remote
        }

        if (!remoteVer) {
          const ghResp = await fetch('https://raw.githubusercontent.com/gcclinux/EasyEditor/refs/heads/main/release/latest.json');
          if (ghResp.ok) {
            const ghData = await ghResp.json();
            remoteVer = ghData.version || '';
          }
        }

        setAvailableVersion(remoteVer || 'unknown');
      } catch (e) {
        setAvailableVersion('unknown');
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
            <h3>{t('about.credits')}</h3>
            <p>{t('about.built_by')}<br />
              <span className="muted">{t('about.last_updated')} {lastUpdated}</span>
            </p>
            <p>{t('about.license')}<br />{t('about.running_version')} <strong>{version || '...'}</strong><br />{t('about.available_version')} <strong>{availableVersion || '...'}</strong></p>
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
                  <li>{t('about.premium_features_li6')}</li>
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
                    <label style={{ display: 'block', fontSize: '0.9em', marginBottom: '4px' }}>{t('about.license_date')}</label>
                    <input
                      type="text"
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      className="license-purchasedate-input"
                      style={{ width: '95%', padding: '4px', borderRadius: '4px', border: '1px solid #ccc', color: 'black' }}
                      placeholder={t('about.license_date_placeholder')}
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
