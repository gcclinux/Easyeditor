import React, { useState, useRef, useEffect } from 'react';
import { FaRobot, FaTimes } from 'react-icons/fa';
import { useLanguage } from '../i18n/LanguageContext';

interface EasyAIPanelProps {
  showEasyAIPanel: boolean;
  setShowEasyAIPanel: (show: boolean) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  onActionSelect?: (action: string, prompt: string) => void;
}

const EasyAIPanel: React.FC<EasyAIPanelProps> = ({
  showEasyAIPanel,
  setShowEasyAIPanel,
  showToast,
  onActionSelect
}) => {
  const { t } = useLanguage();
  const [prompt, setPrompt] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; // Reset height
      // Limit to approximately 10 lines
      const scrollHeight = textareaRef.current.scrollHeight;
      // assuming roughly 20px line height, 5 lines ~ 100px, 10 lines ~ 200px
      textareaRef.current.style.height = `${Math.min(scrollHeight, 200)}px`;
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

  const panelWidth = 400; // Single panel width like EasyNotes

  const actionButtons = [
    { id: 'markdown', label: t('easyai.markdown') },
    { id: 'mermaid', label: t('easyai.mermaid') },
    { id: 'user-story', label: t('easyai.user_story') },
    { id: 'ascii-diag', label: t('easyai.ascii_diag') },
    { id: 'plantuml', label: t('easyai.plantuml') },
    { id: 'md-table', label: t('easyai.md_table') },
    { id: 'fix-code', label: t('easyai.fix_code') },
    { id: 'fix-diag', label: t('easyai.fix_diag') }
  ];

  const handleActionClick = (actionId: string) => {
    if (!prompt.trim()) {
      showToast('Please enter a requirement for EasyAI first.', 'warning');
      return;
    }

    if (onActionSelect) {
      onActionSelect(actionId, prompt);
    } else {
      showToast(`Selected Action: ${actionId}. Logic not yet bound to editor.`, 'info');
    }
  };

  return (
    <div
      ref={panelRef}
      className={`easyai-panel ${showEasyAIPanel ? 'easyai-panel-open' : ''}`}
      style={{
        position: 'fixed',
        top: '120px', // Below the menu bars
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center' }}>
            <FaRobot style={{ marginRight: '10px' }} />
            EasyAI
          </h2>
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

        {/* AI Input Area */}
        <div style={{ marginBottom: '20px' }}>
          <textarea
            ref={textareaRef}
            rows={5}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask EasyAI your requirements here... (e.g. Generate a sequence diagram for a login flow)"
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
              minHeight: '100px', // About 5 lines
              maxHeight: '200px', // About 10 lines
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
      </div>
    </div>
  );
};

export default EasyAIPanel;
