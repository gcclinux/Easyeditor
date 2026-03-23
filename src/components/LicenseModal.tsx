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
  const [agent, setAgent] = React.useState('Ollama');
  const [host, setHost] = React.useState('http://localhost:11434');
  const [model, setModel] = React.useState('ministral-3:3b');
  const [apiKey, setApiKey] = React.useState('');

  const [monthlyCredits, setMonthlyCredits] = React.useState<number | null>(null);
  const [topUpCredits, setTopUpCredits] = React.useState<number | null>(null);
  const [usedCredits, setUsedCredits] = React.useState<number | null>(null);
  const [balanceCredits, setBalanceCredits] = React.useState<number | null>(null);

  React.useEffect(() => {
    const storedEmail = LicenseManager.getStoredEmail();
    if (storedEmail) setEmail(storedEmail);
    const storedLicenseKey = LicenseManager.getStoredLicenseKey();
    if (storedLicenseKey) setLicenseKey(storedLicenseKey);
    const storedType = LicenseManager.getStoredType();
    if (storedType) setType(storedType);
    const storedName = localStorage.getItem('easyeditor-user-name');
    if (storedName) setName(storedName);

    // Load initial EasyAI API Config Native or Web Hybrid
    const loadApiConfig = async () => {
      const isTauri = !!(window as any).__TAURI__;
      try {
        if (isTauri) {
          const { homeDir, join } = await import('@tauri-apps/api/path');
          const { readTextFile, exists } = await import('@tauri-apps/plugin-fs');
          const homePath = await homeDir();
          const configPath = await join(homePath, '.easyeditor', 'easyai-config.env');

          if (await exists(configPath)) {
            const content = await readTextFile(configPath);
            const getEnv = (key: string, defaultVal: string) => {
              const match = content.match(new RegExp(`${key}=(.*)`));
              return match ? match[1].trim() : defaultVal;
            };
            setAgent(getEnv('EASYAI_AGENT', 'Ollama'));
            setHost(getEnv('EASYAI_HOST', 'http://localhost:11434'));
            setModel(getEnv('EASYAI_MODEL', 'ministral-3:3b'));
            setApiKey(getEnv('EASYAI_API_KEY', ''));
          }
        } else {
          const webConfigStr = localStorage.getItem('easyai-config');
          if (webConfigStr) {
            const webConfig = JSON.parse(webConfigStr);
            if (webConfig.agent) setAgent(webConfig.agent);
            if (webConfig.host) setHost(webConfig.host);
            if (webConfig.model) setModel(webConfig.model);
            if (webConfig.apiKey != null) setApiKey(webConfig.apiKey);
          }
        }
      } catch (err) {
        console.warn('Could not load API config init:', err);
      }
    };
    loadApiConfig();

    // Check initial license state
    if (LicenseManager.hasActiveLicense()) {
      setIsLicenseValid(true);
    }

    // Subscribe to license changes to update type
    const unsubscribe = LicenseManager.subscribe(() => {
      setIsLicenseValid(LicenseManager.hasActiveLicense());
      const updatedType = LicenseManager.getType();
      setType(updatedType);
    });

    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    if (isLicenseValid && licenseKey) {
      const fetchCredits = async () => {
        try {
          const gateway = import.meta.env.VITE_TOKENS_GATEWAY;
          const primeKey = import.meta.env.VITE_GATEWAY_PRIME_KEY;
          console.log('[LicenseModal] FetchCredits Triggered. Gateway:', gateway, ' Prime:', primeKey ? 'PRESENT' : 'MISSING', ' License:', licenseKey);

          if (!gateway || !primeKey) {
            console.warn('[LicenseModal] Gateway or PrimeKey missing in Vite build context!');
            return;
          }

          const isTauri = typeof window !== 'undefined' && ((window as any).__TAURI__ !== undefined || (window as any).__TAURI_INTERNALS__ !== undefined);
          let res;

          if (isTauri) {
            const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
            res = await tauriFetch(`${gateway}/api/credits/${licenseKey}`, {
              method: 'GET',
              headers: {
                'X-API-Key': primeKey
              }
            });
          } else {
            res = await fetch(`${gateway}/api/credits/${licenseKey}`, {
              method: 'GET',
              headers: {
                'X-API-Key': primeKey
              }
            });
          }
          
          if (res.ok) {
            const data = await res.json();
            setMonthlyCredits(data.monthlyToken ?? 0);
            setTopUpCredits(data.topUpToken ?? 0);
            setUsedCredits(data.usedToken ?? 0);
            setBalanceCredits(data.availableToken ?? 0);
          }
        } catch (e) {
          console.error("Failed to fetch EasyAI credits", e);
        }
      };
      fetchCredits();
    }
  }, [isLicenseValid, licenseKey]);

  const handleSaveLicense = async () => {
    localStorage.setItem('easyeditor-user-name', name);
    await LicenseManager.setLicenseData(email, licenseKey);
    const valid = LicenseManager.hasActiveLicense();
    setIsLicenseValid(valid);
    setType(LicenseManager.getType());
    if (!valid && showToast) {
      showToast(t('about.invalid_license') || 'Invalid license or email', 'error');
    }
  };

  const handleSaveApiConfig = async () => {
    try {
      const isTauri = !!(window as any).__TAURI__;
      const content = `EASYAI_AGENT=${agent}\nEASYAI_HOST=${host}\nEASYAI_MODEL=${model}\nEASYAI_API_KEY=${apiKey}\n`;

      if (isTauri) {
        const { homeDir, join } = await import('@tauri-apps/api/path');
        const { writeTextFile, mkdir, exists } = await import('@tauri-apps/plugin-fs');
        const homePath = await homeDir();
        const easyEditorDir = await join(homePath, '.easyeditor');
        const configPath = await join(easyEditorDir, 'easyai-config.env');

        if (!(await exists(easyEditorDir))) {
          await mkdir(easyEditorDir, { recursive: true });
        }

        await writeTextFile(configPath, content);

        if (showToast) {
          showToast(`API Config natively saved to ${configPath}`, 'success');
        } else {
          alert('API Configuration saved successfully!');
        }
      } else {
        localStorage.setItem('easyai-config', JSON.stringify({ agent, host, model, apiKey }));
        if (showToast) {
          showToast('API Config secured to browser local storage!', 'success');
        } else {
          alert('API Configuration saved securely to browser!');
        }
      }
    } catch (err) {
      console.error('Failed to save API config:', err);
      if (showToast) {
        showToast('Failed to save configuration', 'error');
      } else {
        alert('Failed to save configuration');
      }
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

          {/* Column 2: PremiumPlus Features & License */}
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
          </div>

          {/* Column 3: API Hosting */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            <div className="about-card">
              <h3>{t('about.easyai_credits')}</h3>
              <div style={{ marginTop: '10px' }}>
                <p style={{ fontSize: '0.9em', margin: '4px 0' }}><strong>{t('about.credits_agent')}</strong> {agent}</p>
                <p style={{ fontSize: '0.9em', margin: '4px 0' }}><strong>{t('about.credits_model')}</strong> {model}</p>
                <p style={{ fontSize: '0.9em', margin: '4px 0' }}><strong>{t('about.credits_monthly')}</strong> {monthlyCredits !== null ? monthlyCredits : t('about.query_built')}</p>
                <p style={{ fontSize: '0.9em', margin: '4px 0' }}><strong>{t('about.credits_topup')}</strong> {topUpCredits !== null ? topUpCredits : t('about.query_built')}</p>
                <p style={{ fontSize: '0.9em', margin: '4px 0' }}><strong>{t('about.credits_used')}</strong> {usedCredits !== null ? usedCredits : t('about.query_built')}</p>
                <p style={{ fontSize: '0.9em', margin: '4px 0' }}><strong>{t('about.credits_balance')}</strong> {balanceCredits !== null ? balanceCredits : t('about.query_built')}</p>
                <a
                  href="https://buy.stripe.com/cNi14ng486TTfaK78LdZ602"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn secondary"
                  style={{ marginTop: '10px', display: 'inline-block', textDecoration: 'none', padding: '6px 12px' }}
                >
                  {t('about.go_premiumplus')}
                </a>
              </div>
            </div>

            <div className="about-card" style={{ flex: 1 }}>
              <h3>{t('about.api_hosting')}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9em', marginBottom: '4px' }}>{t('about.api_agent')}</label>
                  <select
                    className="license-name-input"
                    style={{ width: '95%', boxSizing: 'border-box', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color, #ccc)' }}
                    value={agent}
                    onChange={(e) => setAgent(e.target.value)}
                  >
                    <option value="Ollama">Ollama</option>
                    <option value="Gemini">Gemini</option>
                    <option value="Bedrock">Bedrock</option>
                    <option value="Claude">Claude</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9em', marginBottom: '4px' }}>{t('about.api_host')}</label>
                  <input
                    type="text"
                    className="license-name-input"
                    style={{
                      width: '95%',
                      boxSizing: 'border-box',
                      padding: '4px',
                      borderRadius: '4px',
                      border: '1px solid var(--border-color, #ccc)',
                      opacity: agent !== 'Ollama' ? 0.6 : 1,
                      cursor: agent !== 'Ollama' ? 'not-allowed' : 'text'
                    }}
                    placeholder={t('about.api_host_placeholder')}
                    readOnly={agent !== 'Ollama'}
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9em', marginBottom: '4px' }}>{t('about.api_model')}</label>
                  <input
                    type="text"
                    className="license-name-input"
                    style={{ width: '95%', boxSizing: 'border-box', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color, #ccc)' }}
                    placeholder={t('about.api_model_placeholder')}
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9em', marginBottom: '4px' }}>{t('about.api_key')}</label>
                  <input
                    type="password"
                    className="license-name-input"
                    style={{ width: '95%', boxSizing: 'border-box', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color, #ccc)' }}
                    placeholder={t('about.api_key_placeholder')}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                </div>
                <button
                  onClick={handleSaveApiConfig}
                  className="btn secondary"
                  style={{ marginTop: '10px', alignSelf: 'flex-start', padding: '6px 12px' }}
                >
                  Save Config
                </button>
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

export default LicenseModal;
