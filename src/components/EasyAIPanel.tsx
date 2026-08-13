import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FaRobot, FaTimes, FaFlag, FaDownload, FaLock } from 'react-icons/fa';
import { useLanguage } from '../i18n/LanguageContext';
import { getPersonaDescription } from './easyai/aiPersonas';
import { loadEasyAIConfig, EasyAIConfig, hasPremiumAccess, hasCustomConfig, getPremiumDefaults } from './easyai/aiService';
import ReportContentModal from './ReportContentModal';
import { downloadReportsAsFile, getReports, isTauriEnv } from './easyai/reportService';
import LicenseManager from '../premium/LicenseManager';

interface EasyAIPanelProps {
  showEasyAIPanel: boolean;
  setShowEasyAIPanel: (show: boolean) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  onActionSelect?: (action: string, prompt: string, forcePremiumDefault?: boolean) => void;
  lastAIAction?: string | null;
  lastUserPrompt?: string | null;
  lastAIResponse?: string | null;
}

const EasyAIPanel: React.FC<EasyAIPanelProps> = ({
  showEasyAIPanel,
  setShowEasyAIPanel,
  showToast,
  onActionSelect,
  lastAIAction,
  lastUserPrompt,
  lastAIResponse
}) => {
  const { t } = useLanguage();
  const [prompt, setPrompt] = useState('');
  const [aiConfig, setAiConfig] = useState<EasyAIConfig | null>(null);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [isPremium, setIsPremium] = useState<boolean>(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Track license status
  useEffect(() => {
    setIsPremium(hasPremiumAccess());
    const unsub = LicenseManager.subscribe(() => {
      setIsPremium(hasPremiumAccess());
    });
    return unsub;
  }, []);

  // Reload the displayed config whenever panel visibility or license changes
  const reloadConfig = useCallback(() => {
    loadEasyAIConfig().then(setAiConfig).catch(() => setAiConfig(null));
  }, []);

  useEffect(() => {
    if (showEasyAIPanel) reloadConfig();
  }, [showEasyAIPanel, reloadConfig]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 350)}px`;
    }
  }, [prompt]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showEasyAIPanel &&
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        setShowEasyAIPanel(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEasyAIPanel, setShowEasyAIPanel]);

  const panelWidth = 624;

  const actionButtons = [
    { id: 'markdown', label: t('easyai.markdown') },
    { id: 'mermaid', label: t('easyai.mermaid') },
    { id: 'user-story', label: t('easyai.user_story') },
    { id: 'documentation', label: t('easyai.documentation') },
    { id: 'fix-code', label: t('easyai.fix_code') },
    { id: 'rewrite', label: t('easyai.rewrite') },
    { id: 'architecture', label: t('easyai.architecture') },
    { id: 'implementation', label: t('easyai.implementation') }
  ];

  const handleActionClick = (actionId: string) => {
    if (!isPremium && aiConfig?.agent !== 'Ollama') {
      showToast('EasyAI with cloud models requires a Premium license (BYOK). Free users can use local Ollama.', 'warning');
      return;
    }
    if (isPremium && aiConfig?.agent !== 'Ollama' && !aiConfig?.apiKey) {
      showToast(`API Key required for ${aiConfig?.agent || 'cloud model'}. Configure your API key in Settings > About > EasyAI API Hosting.`, 'error');
      return;
    }
    if (!prompt.trim()) {
      showToast(t('easyai.toast_empty_prompt'), 'warning');
      return;
    }

    if (onActionSelect) {
      onActionSelect(actionId, prompt, false);
    } else {
      showToast(t('easyai.toast_action_not_bound').replace('{{action}}', actionId), 'info');
    }
  };

  // Badge text & colour (BYOK)
  const buildBadge = () => {
    if (!isPremium) {
      return {
        text: `🔒 Free — Local Ollama only (http://localhost:11434)`,
        color: '#f6ad55'
      };
    }
    if (!aiConfig) return null;
    if (aiConfig.agent === 'Ollama') {
      return {
        text: `✓ Ollama (host: ${aiConfig.host.replace(/^https?:\/\//, '')}, model: ${aiConfig.model})`,
        color: '#63b3ed'
      };
    }
    if (!aiConfig.apiKey) {
      return {
        text: `⚠️ ${aiConfig.agent} — API Key required (BYOK). Set in Settings > About > EasyAI API Hosting.`,
        color: '#fc8181'
      };
    }
    return {
      text: `✓ ${aiConfig.agent} (model: ${aiConfig.model}) — BYOK (Your API Key)`,
      color: '#48bb78'
    };
  };

  const badge = buildBadge();

  return (
    <div
      ref={panelRef}
      className={`easyai-panel ${showEasyAIPanel ? 'easyai-panel-open' : ''}`}
      style={{
        position: 'fixed',
        top: '120px',
        right: showEasyAIPanel ? '0' : `-${panelWidth + 35}px`,
        width: `${panelWidth}px`,
        height: 'calc(100vh - 120px)',
        backgroundColor: 'var(--bg-dropdown)',
        color: 'var(--color-text-dropdown)',
        zIndex: 1000000,
        transition: 'right 0.3s ease-in-out',
        borderLeft: '2px solid var(--border-secondary)',
        boxShadow: showEasyAIPanel ? '-2px 0 10px var(--shadow-md)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <div style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        boxSizing: 'border-box'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center' }}>
              <FaRobot style={{ marginRight: '10px' }} />
              EasyAI (Beta)
            </h2>

            {badge && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '6px',
                marginTop: '5px',
              }}>
                <span style={{ fontSize: '0.75rem', color: badge.color, whiteSpace: 'nowrap' }}>
                  {badge.text}
                </span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '8px' }}>
            <button
              onClick={() => setShowReportModal(true)}
              aria-label={t('easyai.report.button')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text-dropdown)',
                fontSize: '1.1rem',
                cursor: 'pointer',
                padding: '5px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title={t('easyai.report.button')}
            >
              <FaFlag />
            </button>
            <button
              onClick={() => setShowEasyAIPanel(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text-dropdown)',
                fontSize: '1.5rem',
                cursor: 'pointer',
                padding: '5px'
              }}
              title="Close EasyAI"
            >
              <FaTimes />
            </button>
          </div>
        </div>

        {/* AI Input Area */}
        <div style={{ marginBottom: '20px' }}>
          <textarea
            ref={textareaRef}
            rows={5}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t('easyai.prompt_placeholder')}
            style={{
              width: '100%',
              backgroundColor: 'var(--bg-primary-light)',
              color: 'var(--color-text-primary)',
              border: '1px solid var(--border-secondary)',
              borderRadius: '6px',
              padding: '12px',
              fontSize: '14px',
              resize: 'none',
              outline: 'none',
              boxSizing: 'border-box',
              minHeight: '180px',
              maxHeight: '350px',
              overflowY: 'auto',
              fontFamily: 'inherit'
            }}
          />
        </div>

        {/* Action Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '10px',
          marginTop: '10px'
        }}>
          {actionButtons.map((action) => (
            <button
              key={action.id}
              onClick={() => handleActionClick(action.id)}
              title={getPersonaDescription(action.id) || action.label}
              style={{
                padding: '12px',
                backgroundColor: 'var(--bg-dropdown-hover)',
                color: '#ffffff',
                border: '1px solid var(--border-secondary)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                transition: 'background-color 0.2s',
                textAlign: 'center'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-primary-light)';
                e.currentTarget.style.borderColor = 'var(--border-focus)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-dropdown-hover)';
                e.currentTarget.style.borderColor = 'var(--border-secondary)';
              }}
            >
              {action.label}
            </button>
          ))}
        </div>

        {/* Download Reports button (web only) */}
        {!isTauriEnv() && (
          <div style={{ marginTop: '16px' }}>
            <button
              onClick={() => downloadReportsAsFile()}
              disabled={getReports().length === 0}
              aria-label={t('easyai.report.download_button')}
              title={getReports().length === 0 ? t('easyai.report.download_empty_tooltip') : t('easyai.report.download_button')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                width: '100%',
                padding: '10px',
                backgroundColor: 'var(--bg-dropdown-hover)',
                color: '#ffffff',
                border: '1px solid var(--border-secondary)',
                borderRadius: '6px',
                cursor: getReports().length === 0 ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                opacity: getReports().length === 0 ? 0.5 : 1,
              }}
            >
              <FaDownload />
              {t('easyai.report.download_button')}
            </button>
          </div>
        )}
      </div>

      {/* Report Content Modal */}
      <ReportContentModal
        open={showReportModal}
        onClose={() => setShowReportModal(false)}
        showToast={showToast}
        lastAIAction={lastAIAction ?? null}
        aiAgent={aiConfig?.agent ?? null}
        aiModel={aiConfig?.model ?? null}
        lastUserPrompt={lastUserPrompt ?? null}
        lastAIResponse={lastAIResponse ?? null}
      />
    </div>
  );
};

export default EasyAIPanel;
