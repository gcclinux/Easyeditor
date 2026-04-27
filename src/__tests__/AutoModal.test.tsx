import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AutoModal from '../components/AutoModal';

// Mock the LanguageContext so useLanguage returns a t function that echoes the key
jest.mock('../i18n/LanguageContext', () => ({
  useLanguage: () => ({
    t: (key: string) => key,
    language: 'en',
    setLanguage: jest.fn(),
  }),
}));

// Mock CSS import
jest.mock('../components/autoModal.css', () => ({}));

describe('AutoModal PDF tile integration', () => {
  const baseProps = {
    onAutoTable: jest.fn(),
    onAutoGantt: jest.fn(),
    onAutoTimeline: jest.fn(),
    onImportMD: jest.fn(),
    onImportDocx: jest.fn(),
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the PDF tile when onImportPdf is provided', () => {
    const onImportPdf = jest.fn();
    render(<AutoModal {...baseProps} onImportPdf={onImportPdf} />);

    // The tile title should render with the i18n key (our mock returns the key itself)
    expect(screen.getByText('templates.import_pdf')).toBeInTheDocument();
    expect(screen.getByText('templates.import_pdf_desc')).toBeInTheDocument();
  });

  it('shows correct i18n text for the PDF tile title and description', () => {
    const onImportPdf = jest.fn();
    render(<AutoModal {...baseProps} onImportPdf={onImportPdf} />);

    const titleEl = screen.getByText('templates.import_pdf');
    expect(titleEl).toHaveClass('auto-tile-title');

    const descEl = screen.getByText('templates.import_pdf_desc');
    expect(descEl).toHaveClass('auto-tile-desc');
  });

  it('calls onImportPdf when the PDF tile is clicked', () => {
    const onImportPdf = jest.fn();
    render(<AutoModal {...baseProps} onImportPdf={onImportPdf} />);

    const pdfTile = screen.getByText('templates.import_pdf').closest('button')!;
    fireEvent.click(pdfTile);

    expect(onImportPdf).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the PDF tile is clicked (modal closes)', () => {
    const onImportPdf = jest.fn();
    const onClose = jest.fn();
    render(<AutoModal {...baseProps} onClose={onClose} onImportPdf={onImportPdf} />);

    const pdfTile = screen.getByText('templates.import_pdf').closest('button')!;
    fireEvent.click(pdfTile);

    expect(onClose).toHaveBeenCalled();
  });

  it('does NOT render the PDF tile when onImportPdf is not provided', () => {
    render(<AutoModal {...baseProps} />);

    expect(screen.queryByText('templates.import_pdf')).not.toBeInTheDocument();
    expect(screen.queryByText('templates.import_pdf_desc')).not.toBeInTheDocument();
  });
});
