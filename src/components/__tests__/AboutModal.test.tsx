import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock png logo
jest.mock('../../assets/128x128@2x.png', () => 'mock-logo', { virtual: true });

// Mock useLanguage hook using actual en.json
jest.mock('../../i18n/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const en = require('../../i18n/locales/en.json');
      const keys = key.split('.');
      let val = en;
      for (const k of keys) val = val?.[k];
      return val || key;
    },
    language: 'en',
    setLanguage: jest.fn(),
    availableLanguages: [],
    importLanguage: jest.fn(),
    isLoading: false,
  }),
}));

import AboutModal from '../AboutModal';

// Mock version utils
jest.mock('../../utils/version', () => ({
  getRunningVersion: jest.fn().mockResolvedValue('2.1.0'),
  getAvailableVersion: jest.fn().mockResolvedValue({ version: '2.1.0' }),
  compareVersions: jest.fn().mockReturnValue(0),
}));

// Mock analytics
jest.mock('../../services/analytics', () => ({
  hasAnalyticsConsent: jest.fn().mockReturnValue(true),
  setAnalyticsConsent: jest.fn(),
}));

describe('AboutModal', () => {
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('does not render when open is false', () => {
    const { container } = render(<AboutModal {...defaultProps} open={false} />);
    expect(container.firstChild).toBeNull();
  });

  test('renders dialog and content when open is true', async () => {
    render(<AboutModal {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Everything You Need')).toBeInTheDocument();
    expect(screen.getByText('Advanced Editing')).toBeInTheDocument();
    expect(screen.getByText('EasyTeam')).toBeInTheDocument();
    expect(screen.getByText('Architect')).toBeInTheDocument();
  });

  test('closes modal when Escape key is pressed', async () => {
    render(<AboutModal {...defaultProps} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  test('does not close modal on other key presses', async () => {
    render(<AboutModal {...defaultProps} />);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  test('closes modal when Close button is clicked', async () => {
    render(<AboutModal {...defaultProps} />);
    const closeBtn = screen.getByText('Close');
    fireEvent.click(closeBtn);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  test('renders German translations when language is de', () => {
    const de = require('../../i18n/locales/de.json');
    expect(de.about.everything_you_need).toBe('Alles, was Sie brauchen');
    expect(de.about.feat_editing_title).toBe('Erweiterte Bearbeitung');
    expect(de.about.persona_architect_name).toBe('Architekt');
  });
});
