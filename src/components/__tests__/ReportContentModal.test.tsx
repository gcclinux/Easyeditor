/**
 * Unit tests for ReportContentModal component
 * Validates: Requirements 2.1, 2.2, 2.4, 2.5, 2.7
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ReportContentModal from '../ReportContentModal';

// Mock useLanguage hook
jest.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'easyai.report.title': 'Report AI Content',
        'easyai.report.category_label': 'Select a category',
        'easyai.report.category_offensive': 'Offensive or Hateful',
        'easyai.report.category_inaccurate': 'Inaccurate or Misleading',
        'easyai.report.category_harmful': 'Harmful or Dangerous',
        'easyai.report.category_explicit': 'Sexually Explicit',
        'easyai.report.category_spam': 'Spam or Irrelevant',
        'easyai.report.category_other': 'Other',
        'easyai.report.description_label': 'Description (optional)',
        'easyai.report.description_placeholder': 'Describe the issue...',
        'easyai.report.submit': 'Submit Report',
        'easyai.report.cancel': 'Cancel',
        'easyai.report.validation_no_category': 'Please select a category',
        'easyai.report.toast_success': 'Report submitted successfully',
        'easyai.report.toast_error': 'Failed to submit report',
        'easyai.report.char_count': '{{count}}/{{max}}',
      };
      return translations[key] ?? key;
    },
    language: 'en',
    setLanguage: jest.fn(),
    availableLanguages: [],
    importLanguage: jest.fn(),
    isLoading: false,
  }),
}));

// Mock reportService
const mockSubmitReport = jest.fn();
const mockIsTauriEnv = jest.fn().mockReturnValue(false);
const mockPersistToFile = jest.fn();
const mockGetReports = jest.fn().mockReturnValue([]);

jest.mock('../easyai/reportService', () => ({
  REPORT_CATEGORIES: ['offensive', 'inaccurate', 'harmful', 'explicit', 'spam', 'other'],
  submitReport: (...args: any[]) => mockSubmitReport(...args),
  isTauriEnv: () => mockIsTauriEnv(),
  persistToFile: (...args: any[]) => mockPersistToFile(...args),
  getReports: () => mockGetReports(),
}));

describe('ReportContentModal', () => {
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    showToast: jest.fn(),
    lastAIAction: 'markdown' as string | null,
    aiAgent: 'Ollama' as string | null,
    aiModel: 'ministral-3:3b' as string | null,
    lastUserPrompt: 'Write a getting started guide' as string | null,
    lastAIResponse: '# Getting Started\n\nWelcome...' as string | null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockSubmitReport.mockReturnValue(true);
    mockIsTauriEnv.mockReturnValue(false);
  });

  describe('rendering when open', () => {
    test('renders all six category options', () => {
      render(<ReportContentModal {...defaultProps} />);

      expect(screen.getByText('Offensive or Hateful')).toBeInTheDocument();
      expect(screen.getByText('Inaccurate or Misleading')).toBeInTheDocument();
      expect(screen.getByText('Harmful or Dangerous')).toBeInTheDocument();
      expect(screen.getByText('Sexually Explicit')).toBeInTheDocument();
      expect(screen.getByText('Spam or Irrelevant')).toBeInTheDocument();
      expect(screen.getByText('Other')).toBeInTheDocument();
    });

    test('renders textarea for description', () => {
      render(<ReportContentModal {...defaultProps} />);

      const textarea = screen.getByPlaceholderText('Describe the issue...');
      expect(textarea).toBeInTheDocument();
      expect(textarea.tagName).toBe('TEXTAREA');
      expect(textarea).toHaveAttribute('maxLength', '500');
    });

    test('renders submit and cancel buttons', () => {
      render(<ReportContentModal {...defaultProps} />);

      expect(screen.getByText('Submit Report')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    test('renders modal with dialog role and aria attributes', () => {
      render(<ReportContentModal {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-label', 'Report AI Content');
    });
  });

  describe('does not render when closed', () => {
    test('renders nothing when open is false', () => {
      const { container } = render(
        <ReportContentModal {...defaultProps} open={false} />
      );
      expect(container.innerHTML).toBe('');
    });
  });

  describe('validation', () => {
    test('shows validation message when submitting without selecting a category', () => {
      render(<ReportContentModal {...defaultProps} />);

      fireEvent.click(screen.getByText('Submit Report'));

      expect(screen.getByText('Please select a category')).toBeInTheDocument();
      expect(mockSubmitReport).not.toHaveBeenCalled();
      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
  });

  describe('cancel and escape', () => {
    test('cancel button closes modal without creating entry', () => {
      render(<ReportContentModal {...defaultProps} />);

      fireEvent.click(screen.getByText('Cancel'));

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
      expect(mockSubmitReport).not.toHaveBeenCalled();
    });

    test('Escape key closes modal without creating entry', () => {
      render(<ReportContentModal {...defaultProps} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
      expect(mockSubmitReport).not.toHaveBeenCalled();
    });
  });

  describe('successful submission', () => {
    test('valid submission calls submitReport, shows success toast, and closes modal', async () => {
      render(<ReportContentModal {...defaultProps} />);

      // Select a category
      const offensiveRadio = screen.getByDisplayValue('offensive');
      fireEvent.click(offensiveRadio);

      // Click submit
      fireEvent.click(screen.getByText('Submit Report'));

      await waitFor(() => {
        expect(mockSubmitReport).toHaveBeenCalledTimes(1);
        expect(mockSubmitReport).toHaveBeenCalledWith(
          expect.objectContaining({
            category: 'offensive',
            description: '',
            aiAction: 'markdown',
          })
        );
        expect(defaultProps.showToast).toHaveBeenCalledWith(
          'Report submitted successfully',
          'success'
        );
        expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('failed submission', () => {
    test('shows error toast when submitReport returns false', async () => {
      mockSubmitReport.mockReturnValue(false);

      render(<ReportContentModal {...defaultProps} />);

      // Select a category
      const harmfulRadio = screen.getByDisplayValue('harmful');
      fireEvent.click(harmfulRadio);

      // Click submit
      fireEvent.click(screen.getByText('Submit Report'));

      await waitFor(() => {
        expect(mockSubmitReport).toHaveBeenCalledTimes(1);
        expect(defaultProps.showToast).toHaveBeenCalledWith(
          'Failed to submit report',
          'error'
        );
        expect(defaultProps.onClose).not.toHaveBeenCalled();
      });
    });
  });
});
