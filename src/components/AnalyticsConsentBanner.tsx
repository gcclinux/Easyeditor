import React from 'react';
import { hasBeenAskedConsent, setAnalyticsConsent } from '../services/analytics';
import { useLanguage } from '../i18n/LanguageContext';

/**
 * A one-time consent banner shown at the bottom of the screen
 * when the user has never been asked about analytics.
 * Once they accept or decline, it never shows again.
 */
export function AnalyticsConsentBanner() {
  const { t } = useLanguage();
  const [visible, setVisible] = React.useState(!hasBeenAskedConsent());

  if (!visible) return null;

  const handleAccept = () => {
    setAnalyticsConsent(true);
    setVisible(false);
  };

  const handleDecline = () => {
    setAnalyticsConsent(false);
    setVisible(false);
  };

  return (
    <div
      role="banner"
      aria-label="Analytics consent"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10000,
        background: 'var(--modal-bg, #1e1e2e)',
        borderTop: '1px solid var(--border-color, #444)',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.3)',
        fontSize: '0.9em',
      }}
    >
      <span style={{ color: 'var(--text-color, #ccc)', lineHeight: 1.4 }}>
        {t('analytics.consent_message')}
      </span>
      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        <button
          onClick={handleDecline}
          style={{
            padding: '6px 14px',
            borderRadius: '4px',
            border: '1px solid var(--border-color, #555)',
            background: 'transparent',
            color: 'var(--text-color, #ccc)',
            cursor: 'pointer',
            fontSize: '0.9em',
          }}
        >
          {t('analytics.decline')}
        </button>
        <button
          onClick={handleAccept}
          style={{
            padding: '6px 14px',
            borderRadius: '4px',
            border: 'none',
            background: 'var(--accent-color, #4a9eff)',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '0.9em',
            fontWeight: 500,
          }}
        >
          {t('analytics.accept')}
        </button>
      </div>
    </div>
  );
}

export default AnalyticsConsentBanner;
