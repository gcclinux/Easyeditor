import React from 'react';
import './aboutModal.css';
import { createPortal } from 'react-dom';
import logo from '../assets/128x128@2x.png';
import { useLanguage } from '../i18n/LanguageContext';

interface APIModalProps {
  open: boolean;
  onClose: () => void;
  showToast?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

const AGENTS = [
  {
    id: 'Ollama',
    label: 'Ollama',
    icon: '🦙',
    desc: 'Local · No API key needed',
    color: '#4a90d9',
    link: 'https://ollama.com/download',
  },
  {
    id: 'Gemini',
    label: 'Gemini',
    icon: '✦',
    desc: 'Google AI · BYOK',
    color: '#4285f4',
    link: 'https://aistudio.google.com/api-keys',
  },
  {
    id: 'Claude',
    label: 'Claude',
    icon: '◆',
    desc: 'Anthropic · BYOK',
    color: '#d97757',
    link: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'Bedrock',
    label: 'Bedrock',
    icon: '⬡',
    desc: 'AWS · BYOK',
    color: '#ff9900',
    link: 'https://console.aws.amazon.com/bedrock/',
  },
];

const AGENT_DEFAULTS: Record<string, { model: string; host: string }> = {
  Ollama:  { model: 'ministral-3:3b',      host: 'http://localhost:11434' },
  Gemini:  { model: 'gemini-2.0-flash',    host: '' },
  Claude:  { model: 'claude-sonnet-4-6',   host: '' },
  Bedrock: { model: 'amazon.nova-pro-v1:0', host: '' },
};

export function APIModal({ open, onClose, showToast }: APIModalProps) {
  const { t } = useLanguage();

  const [agent, setAgent] = React.useState('Ollama');
  const [host, setHost]   = React.useState('http://localhost:11434');
  const [model, setModel] = React.useState('ministral-3:3b');
  const [apiKey, setApiKey] = React.useState('');

  React.useEffect(() => {
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
            const get = (key: string, fb: string) => {
              const m = content.match(new RegExp(`${key}=(.*)`));
              return m ? m[1].trim() : fb;
            };
            setAgent(get('EASYAI_AGENT', 'Ollama'));
            setHost(get('EASYAI_HOST', 'http://localhost:11434'));
            setModel(get('EASYAI_MODEL', 'ministral-3:3b'));
            setApiKey(get('EASYAI_API_KEY', ''));
          }
        } else {
          const raw = localStorage.getItem('easyai-config');
          if (raw) {
            const cfg = JSON.parse(raw);
            if (cfg.agent)         setAgent(cfg.agent);
            if (cfg.host)          setHost(cfg.host);
            if (cfg.model)         setModel(cfg.model);
            if (cfg.apiKey != null) setApiKey(cfg.apiKey);
          }
        }
      } catch (err) {
        console.warn('Could not load API config:', err);
      }
    };
    loadApiConfig();
  }, []);

  const handleAgentSelect = (newAgent: string) => {
    setAgent(newAgent);
    const defaults = AGENT_DEFAULTS[newAgent];
    if (defaults) {
      setModel(defaults.model);
      setHost(defaults.host || 'http://localhost:11434');
      setApiKey('');
    }
  };

  const handleSave = async () => {
    try {
      const isTauri = !!(window as any).__TAURI__;
      const content = `EASYAI_AGENT=${agent}\nEASYAI_HOST=${host}\nEASYAI_MODEL=${model}\nEASYAI_API_KEY=${apiKey}\n`;

      if (isTauri) {
        const { homeDir, join } = await import('@tauri-apps/api/path');
        const { writeTextFile, mkdir, exists } = await import('@tauri-apps/plugin-fs');
        const homePath = await homeDir();
        const dir = await join(homePath, '.easyeditor');
        const configPath = await join(dir, 'easyai-config.env');
        if (!(await exists(dir))) await mkdir(dir, { recursive: true });
        await writeTextFile(configPath, content);
        showToast?.(`Config saved to ${configPath}`, 'success');
      } else {
        localStorage.setItem('easyai-config', JSON.stringify({ agent, host, model, apiKey }));
        showToast?.('Config saved to browser storage', 'success');
      }
    } catch (err) {
      console.error('Failed to save API config:', err);
      showToast?.('Failed to save configuration', 'error');
    }
  };

  const activeAgent = AGENTS.find(a => a.id === agent)!;

  if (!open) return null;

  const modalContent = (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="api-title">
      <div className="modal-content" style={{
        maxWidth: '480px',
        width: '100%',
        borderRadius: '12px',
        overflow: 'hidden',
        background: 'var(--bg-modal, #1e2130)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
      }}>

        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '18px 20px 14px',
          borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.08))',
        }}>
          <a href="https://www.easyeditor.co.uk/" target="_blank" rel="noopener noreferrer">
            <img src={logo} alt="EasyEditor" style={{ width: '36px', height: '36px', borderRadius: '8px' }} />
          </a>
          <div>
            <h2 id="api-title" style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>
              EasyAI — API Config
            </h2>
            <p style={{ margin: 0, fontSize: '0.78rem', opacity: 0.55 }}>
              Bring Your Own Key (BYOK) · select a provider below
            </p>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Agent selector tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
            {AGENTS.map(a => {
              const selected = agent === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => handleAgentSelect(a.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '10px 6px 8px',
                    borderRadius: '8px',
                    border: selected
                      ? `2px solid ${a.color}`
                      : '2px solid transparent',
                    background: selected
                      ? `${a.color}18`
                      : 'var(--bg-dropdown, rgba(255,255,255,0.04))',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    outline: 'none',
                  }}
                >
                  <span style={{ fontSize: '1.4rem', lineHeight: 1, color: selected ? a.color : 'var(--color-text-dropdown, #ccc)' }}>
                    {a.icon}
                  </span>
                  <span style={{ fontSize: '0.78rem', fontWeight: selected ? 700 : 500, color: selected ? a.color : 'var(--color-text-dropdown, #ccc)' }}>
                    {a.label}
                  </span>
                  <span style={{ fontSize: '0.65rem', opacity: 0.55, textAlign: 'center', lineHeight: 1.2 }}>
                    {a.desc}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

            {/* Host — only for Ollama */}
            {agent === 'Ollama' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.65, marginBottom: '4px' }}>
                  Host URL
                </label>
                <input
                  type="text"
                  value={host}
                  onChange={e => setHost(e.target.value)}
                  placeholder="http://localhost:11434"
                  style={inputStyle}
                />
              </div>
            )}

            {/* Model */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.65, marginBottom: '4px' }}>
                Model
              </label>
              <input
                type="text"
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder={AGENT_DEFAULTS[agent]?.model}
                style={inputStyle}
              />
            </div>

            {/* API Key — all except Ollama */}
            {agent !== 'Ollama' && (
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', opacity: 0.65, marginBottom: '4px' }}>
                  API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="Paste your API key here"
                  style={inputStyle}
                />
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={handleSave}
              style={{
                padding: '7px 16px',
                borderRadius: '6px',
                border: 'none',
                background: activeAgent.color,
                color: '#fff',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Save Config
            </button>
            {agent !== 'Ollama' && (
              <a
                href={activeAgent.link}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '7px 14px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
                  color: 'var(--color-text-dropdown, #ccc)',
                  fontSize: '0.82rem',
                  textDecoration: 'none',
                  display: 'inline-block',
                }}
              >
                Get API Key ↗
              </a>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '10px 20px 14px',
          borderTop: '1px solid var(--border-color, rgba(255,255,255,0.08))',
        }}>
          <button className="btn primary" onClick={onClose}>{t('about.close')}</button>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '7px 10px',
  borderRadius: '6px',
  border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
  background: 'var(--bg-input, rgba(255,255,255,0.05))',
  color: 'var(--color-text-dropdown, #e0e0e0)',
  fontSize: '0.85rem',
  outline: 'none',
};

export default APIModal;
