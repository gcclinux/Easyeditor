import React from 'react';
import './aboutModal.css';
import { createPortal } from 'react-dom';
import logo from '../assets/128x128@2x.png';
import { useLanguage } from '../i18n/LanguageContext';
import LicenseManager from '../premium/LicenseManager';

interface APIModalProps {
  open: boolean;
  onClose: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export function APIModal({ open, onClose, showToast }: APIModalProps) {
  const { t } = useLanguage();

  const [email, setEmail] = React.useState('');
  const [licenseKey, setLicenseKey] = React.useState('');
  const [type, setType] = React.useState('');
  const [isLicenseValid, setIsLicenseValid] = React.useState(false);
  const [licenseChecked, setLicenseChecked] = React.useState(false);
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

    LicenseManager.restoreFromCache();
    if (LicenseManager.hasActiveLicense()) {
      setIsLicenseValid(true);
      setType(LicenseManager.getType());
      setLicenseChecked(true);
    }

    const unsubscribe = LicenseManager.subscribe(() => {
      setIsLicenseValid(LicenseManager.hasActiveLicense());
      const updatedType = LicenseManager.getType();
      setType(updatedType);
      setLicenseChecked(true);
    });

    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    if (isLicenseValid && licenseKey) {
      const fetchCredits = async () => {
        try {
          const gateway = import.meta.env.VITE_TOKENS_GATEWAY;
          const primeKey = import.meta.env.VITE_GATEWAY_PRIME_KEY;

          if (!gateway || !primeKey) {
            console.warn('[APIModal] Gateway or PrimeKey missing in Vite build context!');
            return;
          }

          const isTauri = typeof window !== 'undefined' && ((window as any).__TAURI__ !== undefined || (window as any).__TAURI_INTERNALS__ !== undefined);
          let res;

          if (isTauri) {
            const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
            res = await tauriFetch(`${gateway}/api/credits/${licenseKey}`, {
              method: 'GET',
              headers: { 'X-API-Key': primeKey }
            });
          } else {
            res = await fetch(`/api/gateway-proxy/api/credits/${licenseKey}`, {
              method: 'GET',
              headers: { 'X-API-Key': primeKey }
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

  const licenseTier: 'Free' | 'Premium' | 'PremiumPlus' = isLicenseValid
    ? (type === 'PremiumPlus' ? 'PremiumPlus' : 'Premium')
    : 'Free';

  React.useEffect(() => {
    if (licenseChecked && licenseTier === 'Free' && agent !== 'Ollama') {
      setAgent('Ollama');
    }
  }, [licenseChecked, licenseTier, agent]);

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

  const modalContent = (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="api-title">
      <div className="modal-content about-modal">
        <div className="about-hero">
          <div className="about-hero-logo">
            <a href="https://www.easyeditor.co.uk/" target="_blank" rel="noopener noreferrer">
              <img src={logo} alt="EasyEditor" />
            </a>
          </div>
          <div className="about-hero-text">
            <h2 id="api-title" className="about-title">{t('about.api_hosting')}</h2>
            <div className="about-subtitle">{t('about.subtitle')}</div>
            <div className="about-badges">
              <span className="badge">{t('about.badge_easyai')}</span>
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gridTemplateRows: '1fr 1fr', gap: '16px' }}>
          {/* Block 1: EasyAI API Hosting Config */}
          <div className="about-card">
            <h3>{t('about.api_hosting')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.9em', marginBottom: '4px' }}>{t('about.api_agent')}</label>
                <select
                  className="license-name-input"
                  style={{ width: '95%', boxSizing: 'border-box', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color, #ccc)' }}
                  value={agent}
                  disabled={licenseTier === 'Free'}
                  onChange={(e) => setAgent(e.target.value)}
                >
                  <option value="Ollama">Ollama</option>
                  {licenseTier !== 'Free' && (
                    <>
                      <option value="Gemini">Gemini</option>
                      <option value="Bedrock">Bedrock</option>
                      <option value="Claude">Claude</option>
                    </>
                  )}
                  {licenseTier === 'PremiumPlus' && (
                    <option value="PremiumPlus">PremiumPlus</option>
                  )}
                </select>
              </div>
              {agent === 'Ollama' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.9em', marginBottom: '4px' }}>{t('about.api_host')}</label>
                  <input
                    type="text"
                    className="license-name-input"
                    style={{ width: '95%', boxSizing: 'border-box', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color, #ccc)' }}
                    placeholder={t('about.api_host_placeholder')}
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                  />
                </div>
              )}
              <div>
                <label style={{ display: 'block', fontSize: '0.9em', marginBottom: '4px' }}>{t('about.api_model')}</label>
                {agent === 'PremiumPlus' ? (
                  <input
                    type="text"
                    className="license-name-input"
                    style={{ width: '95%', boxSizing: 'border-box', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color, #ccc)', opacity: 0.6, cursor: 'not-allowed' }}
                    readOnly
                    value="Coming soon"
                  />
                ) : (
                  <input
                    type="text"
                    className="license-name-input"
                    style={{ width: '95%', boxSizing: 'border-box', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color, #ccc)' }}
                    placeholder={t('about.api_model_placeholder')}
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  />
                )}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.9em', marginBottom: '4px' }}>{t('about.api_key')}</label>
                {licenseTier === 'Free' ? (
                  <input
                    type="text"
                    className="license-name-input"
                    style={{ width: '95%', boxSizing: 'border-box', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color, #ccc)', opacity: 0.6, cursor: 'not-allowed', fontStyle: 'italic' }}
                    readOnly
                    value="Available with Premium subscription"
                  />
                ) : agent === 'PremiumPlus' ? (
                  <input
                    type="text"
                    className="license-name-input"
                    style={{ width: '95%', boxSizing: 'border-box', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color, #ccc)', opacity: 0.6, cursor: 'not-allowed' }}
                    readOnly
                    value="Coming soon"
                  />
                ) : (
                  <input
                    type="password"
                    className="license-name-input"
                    style={{ width: '95%', boxSizing: 'border-box', padding: '4px', borderRadius: '4px', border: '1px solid var(--border-color, #ccc)' }}
                    placeholder={t('about.api_key_placeholder')}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                  />
                )}
              </div>
              <button
                onClick={handleSaveApiConfig}
                className="btn secondary"
                style={{ marginTop: '10px', alignSelf: 'flex-start', padding: '6px 12px' }}
              >
                {t('about.save_config')}
              </button>
            </div>
          </div>

          {/* Block 2: Empty */}
          <div className="about-card">
          </div>

          {/* Block 3: Empty */}
          <div className="about-card">
          </div>

          {/* Block 4: Empty */}
          <div className="about-card">
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn primary" onClick={onClose}>{t('about.close')}</button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export default APIModal;
