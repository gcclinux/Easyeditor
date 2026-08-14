import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FaRobot, FaTimes, FaFlag, FaDownload, FaSpinner, FaCheckCircle, FaExclamationTriangle, FaInfoCircle, FaTrash } from 'react-icons/fa';
import { useLanguage } from '../i18n/LanguageContext';
import { getPersonaDescription } from './easyai/aiPersonas';
import { loadEasyAIConfig, EasyAIConfig, hasPremiumAccess } from './easyai/aiService';
import ReportContentModal from './ReportContentModal';
import { downloadReportsAsFile, getReports, isTauriEnv } from './easyai/reportService';
import LicenseManager from '../premium/LicenseManager';

export interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

interface EasyAIPanelProps {
  showEasyAIPanel: boolean;
  setShowEasyAIPanel: (show: boolean) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  onActionSelect?: (action: string, prompt: string, forcePremiumDefault?: boolean) => void;
  lastAIAction?: string | null;
  lastUserPrompt?: string | null;
  lastAIResponse?: string | null;
  isWorking?: boolean;
  workingAction?: string | null;
  workingMessage?: string | null;
  sessionResult?: { status: 'success' | 'error' | 'info' | 'warning' | 'cancelled'; message: string } | null;
  scanProgress?: { isScanning: boolean; currentFile: string; filesProcessed: number; totalFiles: number };
  onCancelScan?: () => void;
  onClearSession?: () => void;
  toasts?: ToastItem[];
  onClearToasts?: () => void;
}

const EasyAIPanel: React.FC<EasyAIPanelProps> = ({
  showEasyAIPanel,
  setShowEasyAIPanel,
  showToast,
  onActionSelect,
  lastAIAction,
  lastUserPrompt,
  lastAIResponse,
  isWorking = false,
  workingAction = null,
  workingMessage = null,
  sessionResult = null,
  scanProgress,
  onCancelScan,
  onClearSession,
  toasts = [],
  onClearToasts
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
    if (isWorking || scanProgress?.isScanning) {
      showToast('EasyAI is currently working on an action. Please wait or cancel.', 'warning');
      return;
    }
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
      <style>{`
        @keyframes easyai-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .easyai-spin-icon {
          animation: easyai-spin 1s linear infinite;
        }
      `}</style>
      <div style={{
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        boxSizing: 'border-box',
        overflowY: 'auto'
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
            disabled={isWorking || scanProgress?.isScanning}
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
              fontFamily: 'inherit',
              opacity: (isWorking || scanProgress?.isScanning) ? 0.7 : 1
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
          {actionButtons.map((action) => {
            const isThisWorking = isWorking && workingAction === action.id;
            return (
              <button
                key={action.id}
                onClick={() => handleActionClick(action.id)}
                disabled={isWorking || scanProgress?.isScanning}
                title={getPersonaDescription(action.id) || action.label}
                style={{
                  padding: '12px',
                  backgroundColor: isThisWorking ? '#2b6cb0' : 'var(--bg-dropdown-hover)',
                  color: '#ffffff',
                  border: isThisWorking ? '1px solid #63b3ed' : '1px solid var(--border-secondary)',
                  borderRadius: '6px',
                  cursor: (isWorking || scanProgress?.isScanning) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s',
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  opacity: (isWorking || scanProgress?.isScanning) && !isThisWorking ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isWorking && !scanProgress?.isScanning) {
                    e.currentTarget.style.backgroundColor = 'var(--bg-primary-light)';
                    e.currentTarget.style.borderColor = 'var(--border-focus)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isWorking && !scanProgress?.isScanning) {
                    e.currentTarget.style.backgroundColor = 'var(--bg-dropdown-hover)';
                    e.currentTarget.style.borderColor = 'var(--border-secondary)';
                  }
                }}
              >
                {isThisWorking && <FaSpinner className="easyai-spin-icon" />}
                {action.label}
              </button>
            );
          })}
        </div>

        {/* Working Status / Progress Box under Personas */}
        {(isWorking || sessionResult || scanProgress?.isScanning) && (
          <div style={{
            marginTop: '16px',
            padding: '14px 16px',
            borderRadius: '8px',
            backgroundColor: 'var(--bg-primary-light, #252526)',
            border: `1px solid ${
              (isWorking || scanProgress?.isScanning)
                ? '#007acc'
                : sessionResult?.status === 'error'
                ? '#f56565'
                : sessionResult?.status === 'warning'
                ? '#ed8936'
                : sessionResult?.status === 'success'
                ? '#48bb78'
                : 'var(--border-secondary, #3c3c3c)'
            }`,
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            transition: 'all 0.3s ease'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', fontSize: '0.9rem' }}>
                {(isWorking || scanProgress?.isScanning) ? (
                  <FaSpinner className="easyai-spin-icon" style={{ color: '#63b3ed' }} />
                ) : sessionResult?.status === 'success' ? (
                  <FaCheckCircle style={{ color: '#48bb78' }} />
                ) : sessionResult?.status === 'error' ? (
                  <FaExclamationTriangle style={{ color: '#f56565' }} />
                ) : sessionResult?.status === 'warning' ? (
                  <FaExclamationTriangle style={{ color: '#ed8936' }} />
                ) : (
                  <FaInfoCircle style={{ color: '#63b3ed' }} />
                )}
                <span>
                  {workingAction
                    ? `Persona (${actionButtons.find(b => b.id === workingAction)?.label || workingAction})`
                    : (isWorking || scanProgress?.isScanning) ? 'AI Agent Working...' : 'Session Status'}
                </span>
              </div>

              {!isWorking && !scanProgress?.isScanning && (sessionResult || onClearSession) && (
                <button
                  onClick={onClearSession}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-text-muted, #a0aec0)',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="Clear Session Status"
                >
                  <FaTimes /> Clear
                </button>
              )}
            </div>

            {/* Status Detail Message */}
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-dropdown, #e2e8f0)', wordBreak: 'break-word' }}>
              {workingMessage || sessionResult?.message || (scanProgress?.isScanning ? 'Scanning repository files...' : '')}
            </div>

            {/* Repository Scan Progress Bar */}
            {scanProgress?.isScanning && (
              <div style={{ marginTop: '12px' }}>
                <div style={{
                  width: '100%',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '4px',
                  height: '8px',
                  overflow: 'hidden',
                  marginBottom: '8px'
                }}>
                  <div style={{
                    height: '100%',
                    backgroundColor: '#007acc',
                    width: `${scanProgress.totalFiles > 0 ? (scanProgress.filesProcessed / scanProgress.totalFiles) * 100 : 0}%`,
                    transition: 'width 0.3s ease'
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#a0aec0' }}>
                  <span>{scanProgress.filesProcessed} / {scanProgress.totalFiles} files</span>
                  {onCancelScan && (
                    <button
                      onClick={onCancelScan}
                      style={{
                        backgroundColor: '#e53e3e',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        padding: '3px 10px',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        fontWeight: '500'
                      }}
                    >
                      Cancel Scan
                    </button>
                  )}
                </div>
                {scanProgress.currentFile && (
                  <div style={{
                    fontSize: '0.75rem',
                    color: '#718096',
                    marginTop: '4px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {scanProgress.currentFile}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Toaster Messages Feed Section */}
        <div style={{ marginTop: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted, #a0aec0)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Activity & Notification Toasts
            </span>
            {toasts && toasts.length > 0 && onClearToasts && (
              <button
                onClick={onClearToasts}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-muted, #a0aec0)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title="Clear Notification History"
              >
                <FaTrash size={10} /> Clear Toasts
              </button>
            )}
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            paddingRight: '4px',
            maxHeight: '260px',
            overflowY: 'auto'
          }}>
            {(!toasts || toasts.length === 0) ? (
              <div style={{ fontSize: '0.8rem', color: '#718096', fontStyle: 'italic', padding: '8px 0' }}>
                No recent activity. Select a persona above to start.
              </div>
            ) : (
              toasts.slice().reverse().map((tItem) => (
                <div
                  key={tItem.id}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    backgroundColor: 'var(--bg-primary-light, #2d3748)',
                    borderLeft: `4px solid ${
                      tItem.type === 'success' ? '#48bb78' :
                      tItem.type === 'error' ? '#f56565' :
                      tItem.type === 'warning' ? '#ed8936' : '#4299e1'
                    }`,
                    color: 'var(--color-text-dropdown, #edf2f7)'
                  }}
                >
                  <span style={{ marginTop: '2px' }}>
                    {tItem.type === 'success' && <FaCheckCircle style={{ color: '#48bb78' }} />}
                    {tItem.type === 'error' && <FaExclamationTriangle style={{ color: '#f56565' }} />}
                    {tItem.type === 'warning' && <FaExclamationTriangle style={{ color: '#ed8936' }} />}
                    {tItem.type === 'info' && <FaInfoCircle style={{ color: '#4299e1' }} />}
                  </span>
                  <span style={{ flex: 1, wordBreak: 'break-word', lineHeight: 1.4 }}>
                    {tItem.message}
                  </span>
                </div>
              ))
            )}
          </div>
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
