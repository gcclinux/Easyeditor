import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../i18n/LanguageContext';
import {
  REPORT_CATEGORIES,
  submitReport,
  isTauriEnv,
  persistToFile,
  getReports,
} from './easyai/reportService';

interface ReportContentModalProps {
  open: boolean;
  onClose: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  lastAIAction: string | null;
  aiAgent: string | null;
  aiModel: string | null;
  lastUserPrompt: string | null;
  lastAIResponse: string | null;
}

const ReportContentModal: React.FC<ReportContentModalProps> = ({
  open,
  onClose,
  showToast,
  lastAIAction,
  aiAgent,
  aiModel,
  lastUserPrompt,
  lastAIResponse,
}) => {
  const { t } = useLanguage();
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [description, setDescription] = useState('');
  const [validationError, setValidationError] = useState('');

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setSelectedCategory('');
      setDescription('');
      setValidationError('');
    }
  }, [open]);

  // Escape key handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  const handleSubmit = async () => {
    if (!selectedCategory) {
      setValidationError(t('easyai.report.validation_no_category'));
      return;
    }

    const entry = {
      category: selectedCategory,
      description,
      timestamp: new Date().toISOString(),
      aiAction: lastAIAction,
      aiAgent,
      aiModel,
      userPrompt: lastUserPrompt,
      aiResponse: lastAIResponse,
    };

    const success = submitReport(entry);

    if (success) {
      showToast(t('easyai.report.toast_success'), 'success');

      // Check Tauri file persistence result
      if (isTauriEnv()) {
        const fileSuccess = await persistToFile(getReports());
        if (!fileSuccess) {
          showToast(t('easyai.report.toast_file_warning'), 'warning');
        }
      }

      onClose();
    } else {
      showToast(t('easyai.report.toast_error'), 'error');
    }
  };

  const categoryKeyMap: Record<string, string> = {
    offensive: 'easyai.report.category_offensive',
    inaccurate: 'easyai.report.category_inaccurate',
    harmful: 'easyai.report.category_harmful',
    explicit: 'easyai.report.category_explicit',
    spam: 'easyai.report.category_spam',
    other: 'easyai.report.category_other',
  };

  if (!open) return null;

  const content = (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-label={t('easyai.report.title')}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '480px', padding: '24px' }}
      >
        <h3 style={{ marginTop: 0 }}>{t('easyai.report.title')}</h3>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
            {t('easyai.report.category_label')}
          </label>
          {REPORT_CATEGORIES.map((cat) => (
            <label
              key={cat}
              style={{
                display: 'block',
                padding: '6px 8px',
                cursor: 'pointer',
                borderRadius: '4px',
                backgroundColor: selectedCategory === cat ? 'var(--bg-hover, rgba(255,255,255,0.1))' : 'transparent',
              }}
            >
              <input
                type="radio"
                name="report-category"
                value={cat}
                checked={selectedCategory === cat}
                onChange={() => {
                  setSelectedCategory(cat);
                  setValidationError('');
                }}
                style={{ marginRight: '8px' }}
              />
              {t(categoryKeyMap[cat])}
            </label>
          ))}
          {validationError && (
            <div style={{ color: '#ff6b6b', fontSize: '0.85em', marginTop: '6px' }}>
              {validationError}
            </div>
          )}
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
            {t('easyai.report.description_label')}
          </label>
          <textarea
            placeholder={t('easyai.report.description_placeholder')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            rows={4}
            style={{
              width: '100%',
              resize: 'vertical',
              boxSizing: 'border-box',
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid var(--border-color, #555)',
              backgroundColor: 'var(--bg-input, #2a2a2a)',
              color: 'var(--color-text-primary, #fff)',
            }}
          />
          <div style={{ fontSize: '0.8em', textAlign: 'right', opacity: 0.7 }}>
            {t('easyai.report.char_count').replace('{{count}}', String(description.length)).replace('{{max}}', '500')}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button className="btn secondary" onClick={onClose}>
            {t('easyai.report.cancel')}
          </button>
          <button className="btn primary" onClick={handleSubmit}>
            {t('easyai.report.submit')}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default ReportContentModal;
