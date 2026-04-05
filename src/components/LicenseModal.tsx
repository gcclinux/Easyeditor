import React from 'react';
import './aboutModal.css';
import { createPortal } from 'react-dom';
import logo from '../assets/128x128@2x.png';
import { useLanguage } from '../i18n/LanguageContext';
import LicenseManager from '../premium/LicenseManager';

interface LicenseModalProps {
  open: boolean;
  onClose: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export function LicenseModal({ open, onClose, showToast }: LicenseModalProps) {
  const { t } = useLanguage();


  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [licenseKey, setLicenseKey] = React.useState('');
  const [type, setType] = React.useState('');
  const [isLicenseValid, setIsLicenseValid] = React.useState(false);

  React.useEffect(() => {
    const storedEmail = LicenseManager.getStoredEmail();
    if (storedEmail) setEmail(storedEmail);
    const storedLicenseKey = LicenseManager.getStoredLicenseKey();
    if (storedLicenseKey) setLicenseKey(storedLicenseKey);
    const storedType = LicenseManager.getStoredType();
    if (storedType) setType(storedType);
    const storedName = localStorage.getItem('easyeditor-user-name');
    if (storedName) setName(storedName);

    // Check initial license state (restore from cache synchronously first)
    LicenseManager.restoreFromCache();
    if (LicenseManager.hasActiveLicense()) {
      setIsLicenseValid(true);
      setType(LicenseManager.getType());
    }

    // Subscribe to license changes to update type
    const unsubscribe = LicenseManager.subscribe(() => {
      setIsLicenseValid(LicenseManager.hasActiveLicense());
      const updatedType = LicenseManager.getType();
      setType(updatedType);
    });

    return () => unsubscribe();
  }, []);

  const handleSaveLicense = async () => {
    localStorage.setItem('easyeditor-user-name', name);
    console.log('[LicenseModal] Checking license for email:', email);
    await LicenseManager.setLicenseData(email, licenseKey);
    const valid = LicenseManager.hasActiveLicense();
    const licType = LicenseManager.getType();
    console.log('[LicenseModal] License check result: valid=', valid, ', type=', licType);
    setIsLicenseValid(valid);
    setType(licType);
    if (valid && showToast) {
      showToast(`License activated: ${licType || 'Premium'}`, 'success');
    } else if (!valid && showToast) {
      showToast(t('about.invalid_license') || 'Invalid license or email', 'error');
    }
  };



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
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {/* Column 1: Free Features */}
          <div className="about-card" style={{ display: 'flex', flexDirection: 'column' }}>
            <h3>{t('about.free_features')}</h3>
            <ul style={{ paddingLeft: '20px', lineHeight: '1.5', fontSize: '0.9em', marginTop: '10px' }}>
              <li>{t('about.free_li1')}</li>
              <li>{t('about.free_li2')}</li>
              <li>{t('about.free_li3')}</li>
              <li>{t('about.free_li4')}</li>
              <li>{t('about.free_li5')}</li>
              <li>{t('about.free_li6')}</li>
              <li>{t('about.free_li7')}</li>
              <li>{t('about.free_li8')}</li>
              <li>{t('about.free_li9')}</li>
              <li>{t('about.free_li10')}</li>
              <li>{t('about.free_li11')}</li>
              <li>{t('about.free_li12')}</li>
              <li>{t('about.free_li13')}</li>
              <li>{t('about.free_li14')}</li>
              <li>{t('about.free_li15')}</li>
              <li>{t('about.free_li16')}</li>
            </ul>
            <hr style={{ border: 'none', borderTop: '1px solid var(--border-color, #eee)', margin: '10px 0' }} />
            <h3>{t('about.premium_features')}</h3>
            <ul style={{ paddingLeft: '20px', lineHeight: '1.6', fontSize: '0.9em', marginTop: '10px', marginBottom: '10px' }}>
              <li>{t('about.premium_li1')}</li>
              <li>{t('about.premium_li2')}</li>
              <li>{t('about.premium_li3')}</li>
              <li>{t('about.premium_li4')}</li>
            </ul>
          </div>

          {/* Column 2: PremiumPlus Features */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="about-card" style={{ display: 'flex', flexDirection: 'column' }}>
              <h3>{t('about.premiumplus_features')}</h3>
              <ul style={{ paddingLeft: '20px', lineHeight: '1.6', fontSize: '0.9em', marginTop: '10px' }}>
                <li>{t('about.premiumplus_li1')}</li>
                <li>{t('about.premiumplus_li2')}
                  <ul style={{ paddingLeft: '20px', marginTop: '4px', listStyleType: 'circle' }}>
                    <li>{t('about.persona_li1')}</li>
                    <li>{t('about.persona_li2')}</li>
                    <li>{t('about.persona_li3')}</li>
                    <li>{t('about.persona_li4')}</li>
                    <li>{t('about.persona_li5')}</li>
                    <li>{t('about.persona_li6')}</li>
                    <li>{t('about.persona_li7')}</li>
                    <li>{t('about.persona_li8')}</li>
                  </ul>
                </li>
                <br></br>
              </ul>
            </div>

            <div className="about-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <h3>{t('about.agpl_title')}</h3>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color, #eee)', margin: '2px 0' }} />
              <p style={{ fontSize: '0.9em', fontWeight: 600, margin: 0 }}>{t('about.agpl_allowed')}</p>
              <ul style={{ paddingLeft: '18px', lineHeight: '1.6', fontSize: '0.9em', margin: 0 }}>
                <li>{t('about.agpl_li1')}</li>
                <li>{t('about.agpl_li2')}</li>
                <li>{t('about.agpl_li3')}</li>
                <li>{t('about.agpl_li4')}</li>
                <li>{t('about.agpl_li5')}</li>
              </ul>
            </div>
          </div>

          {/* Column 3: License & Trademark */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="about-card" style={{ flex: 1 }}>
              <h3 style={{ whiteSpace: 'nowrap' }}>{t('about.license_info')} ({isLicenseValid && type ? type : isLicenseValid ? t('about.license_premium') : t('about.license_free')}) </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9em', marginBottom: '4px' }}>{t('about.license_name')}</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="license-name-input"
                    style={{ width: '95%', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color, #ccc)' }}
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
                    style={{ width: '95%', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color, #ccc)' }}
                    placeholder={t('about.license_email_placeholder')}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9em', marginBottom: '4px' }}>{t('about.license_key')}</label>
                  <input
                    type="text"
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(e.target.value)}
                    className="license-key-input"
                    style={{ width: '95%', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color, #ccc)' }}
                    placeholder={t('about.license_key_placeholder')}
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
            <div className="about-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <h3>{t('about.trademark_title')}</h3>
              <p style={{ fontSize: '0.8em', margin: 0, opacity: 0.7 }}>{t('about.trademark_copyright')}</p>
              <hr style={{ border: 'none', borderTop: '1px solid var(--border-color, #eee)', margin: '2px 0' }} />
              <p style={{ fontSize: '0.9em', fontWeight: 600, margin: 0 }}>{t('about.trademark_you_may_not')}</p>
              <ul style={{ paddingLeft: '18px', lineHeight: '1.6', fontSize: '0.9em', margin: 0 }}>
                <li>{t('about.trademark_li1')}
                  <ul style={{ paddingLeft: '16px', marginTop: '2px', listStyleType: 'circle', fontSize: '0.95em' }}>
                    <li>{t('about.trademark_li1_names')}</li>
                  </ul>
                </li>
                <li>{t('about.trademark_li2')}</li>
                <li>{t('about.trademark_li3')}</li>
                <li>{t('about.trademark_li4')}</li>
                <li>{t('about.trademark_li5')}</li>
              </ul>
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

export default LicenseModal;
