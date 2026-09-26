import React from 'react';
import { createPortal } from 'react-dom';
import logo from '../assets/128x128@2x.png';
import { useLanguage } from '../i18n/LanguageContext';
import { hasAnalyticsConsent, setAnalyticsConsent } from '../services/analytics';
import { getRunningVersion, getAvailableVersion, compareVersions } from '../utils/version';

interface AboutModalProps {
  open: boolean;
  onClose: () => void;
}

// ── Feature tiles ──────────────────────────────────────────────────────────────
const FEATURES = [
  // ── Row 1 ──────────────────────────────────────────────────────────────────
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
        <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
    color: '#a78bfa',
    titleKey: 'about.feat_editing_title',
    descKey: 'about.feat_editing_desc',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
    color: '#818cf8',
    titleKey: 'about.feat_diagrams_title',
    descKey: 'about.feat_diagrams_desc',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
        <line x1="6" y1="3" x2="6" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" />
      </svg>
    ),
    color: '#34d399',
    titleKey: 'about.feat_git_title',
    descKey: 'about.feat_git_desc',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
        <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
      </svg>
    ),
    color: '#38bdf8',
    titleKey: 'about.feat_cloud_title',
    descKey: 'about.feat_cloud_desc',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    color: '#4ade80',
    titleKey: 'about.feat_easyteam_title',
    descKey: 'about.feat_easyteam_desc',
  },
  // ── Row 2 ──────────────────────────────────────────────────────────────────
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    color: '#fbbf24',
    titleKey: 'about.feat_templates_title',
    descKey: 'about.feat_templates_desc',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
        <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
    ),
    color: '#f472b6',
    titleKey: 'about.feat_exports_title',
    descKey: 'about.feat_exports_desc',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    color: '#fb7185',
    titleKey: 'about.feat_secure_title',
    descKey: 'about.feat_secure_desc',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    color: '#facc15',
    titleKey: 'about.feat_multiplatform_title',
    descKey: 'about.feat_multiplatform_desc',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 28, height: 28 }}>
        <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /><path d="M9 21V9" />
      </svg>
    ),
    color: '#a78bfa',
    titleKey: 'about.feat_themes_title',
    descKey: 'about.feat_themes_desc',
  },
];

// ── EasyAI personas ────────────────────────────────────────────────────────────
const PERSONAS = [
  { nameKey: 'about.persona_architect_name',    icon: '🏗️',  descKey: 'about.persona_architect_desc' },
  { nameKey: 'about.persona_developer_name',    icon: '👨‍💻', descKey: 'about.persona_developer_desc' },
  { nameKey: 'about.persona_writer_name',       icon: '✍️',  descKey: 'about.persona_writer_desc' },
  { nameKey: 'about.persona_analyst_name',      icon: '📊',  descKey: 'about.persona_analyst_desc' },
  { nameKey: 'about.persona_tester_name',       icon: '🧪',  descKey: 'about.persona_tester_desc' },
  { nameKey: 'about.persona_scrum_master_name', icon: '🏃',  descKey: 'about.persona_scrum_master_desc' },
  { nameKey: 'about.persona_ux_designer_name',  icon: '🎨',  descKey: 'about.persona_ux_designer_desc' },
  { nameKey: 'about.persona_security_name',     icon: '🔒',  descKey: 'about.persona_security_desc' },
];

// ── Styles ─────────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 99999,
    background: 'rgba(0,0,0,0.72)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '20px',
  },
  modal: {
    width: '100%', maxWidth: '1100px',
    maxHeight: '90vh', overflowY: 'auto',
    background: 'var(--bg-modal, #0f1117)',
    borderRadius: '16px',
    boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
    display: 'flex', flexDirection: 'column',
    color: 'var(--color-text-dropdown, #e2e8f0)',
    scrollbarWidth: 'thin',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: '14px',
    padding: '22px 28px 18px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    flexShrink: 0,
  },
  section: {
    padding: '24px 28px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  sectionTitle: {
    fontSize: '1.1rem', fontWeight: 700, margin: '0 0 4px',
    letterSpacing: '-0.01em',
  },
  sectionSub: {
    fontSize: '0.82rem', opacity: 0.5, margin: '0 0 20px',
  },
  featureGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(5, 1fr)',
    gap: '20px 24px',
  },
  featureItem: {
    display: 'flex', flexDirection: 'column', gap: '6px',
  },
  featureTitle: {
    fontSize: '0.88rem', fontWeight: 700, margin: 0,
  },
  featureDesc: {
    fontSize: '0.78rem', opacity: 0.55, lineHeight: 1.5, margin: 0,
  },
  personaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '10px',
  },
  personaTile: {
    borderRadius: '8px',
    padding: '10px 12px',
    background: 'rgba(167,139,250,0.08)',
    border: '1px solid rgba(167,139,250,0.18)',
    display: 'flex', flexDirection: 'column', gap: '2px',
  },
  personaIcon: { fontSize: '1.2rem', lineHeight: 1 },
  personaName: { fontSize: '0.8rem', fontWeight: 600, marginTop: '4px' },
  personaDesc: { fontSize: '0.72rem', opacity: 0.5 },
  footer: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '14px 28px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    flexShrink: 0,
  },
};

// ── Component ──────────────────────────────────────────────────────────────────
export function AboutModal({ open, onClose }: AboutModalProps) {
  const { t } = useLanguage();
  const [version, setVersion]               = React.useState('');
  const [availableVersion, setAvailableVersion] = React.useState('');
  const [analyticsEnabled, setAnalyticsEnabled] = React.useState(hasAnalyticsConsent());

  React.useEffect(() => {
    (async () => {
      setVersion(await getRunningVersion());
      setAvailableVersion((await getAvailableVersion()).version);
    })();
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const hasUpdate = version && availableVersion && compareVersions(version, availableVersion) < 0;

  const content = (
    <div style={S.overlay} role="dialog" aria-modal="true" aria-labelledby="about-title">
      <div style={S.modal}>

        {/* ── Header ── */}
        <div style={S.header}>
          <a href="https://www.easyeditor.co.uk/" target="_blank" rel="noopener noreferrer">
            <img src={logo} alt="EasyEditor" style={{ width: 44, height: 44, borderRadius: 10 }} />
          </a>
          <div style={{ flex: 1 }}>
            <h2 id="about-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>
              {t('about.title')}
            </h2>
            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.5 }}>
              {t('about.subtitle')}
            </p>
          </div>
          <div style={{ textAlign: 'right', fontSize: '0.75rem', opacity: 0.4, lineHeight: 1.6 }}>
            <div>v{version || '…'} {t('about.installed')}</div>
            <div>v{availableVersion || '…'} {t('about.available')}</div>
            {hasUpdate && (
              <a href="https://github.com/gcclinux/EasyEdit/releases/latest" target="_blank" rel="noopener noreferrer"
                style={{ color: '#34d399', textDecoration: 'none', fontWeight: 600, opacity: 1 }}>
                {t('about.update_available')}
              </a>
            )}
          </div>
        </div>

        {/* ── Everything You Need ── */}
        <div style={S.section}>
          <h3 style={S.sectionTitle}>{t('about.everything_you_need')}</h3>
          <p style={S.sectionSub}>
            {t('about.everything_you_need_sub')}
          </p>
          <div style={S.featureGrid}>
            {FEATURES.map(f => (
              <div key={f.titleKey} style={S.featureItem}>
                <div style={{ color: f.color, marginBottom: 4 }}>{f.icon}</div>
                <p style={{ ...S.featureTitle, color: f.color }}>{t(f.titleKey)}</p>
                <p style={S.featureDesc}>{t(f.descKey)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── EasyAI Personas ── */}
        <div style={S.section}>
          <h3 style={S.sectionTitle}>
            <span style={{ color: '#a78bfa' }}>EasyAI</span> {t('about.easyai_title_suffix')}
          </h3>
          <p style={S.sectionSub}>
            {t('about.easyai_personas_desc')}
          </p>
          <div style={S.personaGrid}>
            {PERSONAS.map(p => (
              <div key={p.nameKey} style={S.personaTile}>
                <span style={S.personaIcon}>{p.icon}</span>
                <span style={S.personaName}>{t(p.nameKey)}</span>
                <span style={S.personaDesc}>{t(p.descKey)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Powered by / Credits ── */}
        <div style={{ ...S.section, borderBottom: 'none' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <p style={{ margin: '0 0 6px', fontSize: '0.78rem', fontWeight: 700, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('about.powered_by_label')}</p>
              {[
                ['Mermaid', 'https://mermaid.js.org/'],
                ['Markdown', 'https://daringfireball.net/projects/markdown/'],
                ['PlantUML', 'https://plantuml.com/'],
                ['KaTeX', 'https://katex.org/'],
              ].map(([name, url]) => (
                <a key={name} href={url} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-block', marginRight: 12, marginBottom: 4, fontSize: '0.8rem', color: '#818cf8', textDecoration: 'none', fontWeight: 600 }}>
                  {name}
                </a>
              ))}
            </div>
            <div>
              <p style={{ margin: '0 0 6px', fontSize: '0.78rem', fontWeight: 700, opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t('about.license_label')}</p>
              <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.55, lineHeight: 1.6 }}>
                {t('about.built_by')}<br />
                <a href="https://easyeditor.co.uk/license" target="_blank" rel="noopener noreferrer"
                  style={{ color: '#818cf8' }}>{t('about.license_text')}</a>
              </p>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={S.footer}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem', opacity: 0.6, userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={analyticsEnabled}
              onChange={e => { setAnalyticsEnabled(e.target.checked); setAnalyticsConsent(e.target.checked); }}
              style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#818cf8' }}
            />
            {t('analytics.toggle_label')}
          </label>
          <span style={{ fontSize: '0.75rem', opacity: 0.35 }}>{t('analytics.toggle_description')}</span>
          <div style={{ marginLeft: 'auto' }}>
            <button className="btn primary" onClick={onClose}>{t('about.close')}</button>
          </div>
        </div>

      </div>
    </div>
  );

  return createPortal(content, document.body);
}

export default AboutModal;
