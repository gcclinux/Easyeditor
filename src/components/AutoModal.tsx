import React from 'react';
import { FaBolt, FaTable, FaProjectDiagram, FaFileImport, FaTimes, FaStream, FaFileWord, FaFilePdf } from 'react-icons/fa';
import { useLanguage } from '../i18n/LanguageContext';
import './autoModal.css';

type Props = {
    onAutoTable: () => void;
    onAutoGantt: () => void;
    onAutoTimeline: () => void;
    onImportMD: () => void;
    onImportDocx: () => void;
    onImportPdf?: () => void;
    onTransferMD: () => void;
    onClose: () => void;
};

export default function AutoModal({
    onAutoTable,
    onAutoGantt,
    onAutoTimeline,
    onImportMD,
    onImportDocx,
    onImportPdf,
    onTransferMD,
    onClose
}: Props) {
    const { t } = useLanguage();

    const renderTile = (
        icon: React.ReactNode,
        title: string,
        desc: string,
        onClick: () => void
    ) => {
        return (
            <button
                className="auto-tile"
                onClick={() => {
                    onClick();
                    onClose();
                }}
            >
                <div className="auto-tile-icon">
                    {icon}
                </div>
                <div className="auto-tile-title">{title}</div>
                <div className="auto-tile-desc">{desc}</div>
            </button>
        );
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content auto-modal" onClick={(e) => e.stopPropagation()}>
                <h2>
                    <FaBolt /> {t('toolbar.auto')}
                </h2>

                <div className="auto-tiles-section">
                    <div className="auto-tiles-grid">
                        {renderTile(
                            <FaTable />,
                            t('auto_generate.table'),
                            t('auto_generate.table_desc'),
                            onAutoTable
                        )}
                        {renderTile(
                            <FaProjectDiagram />,
                            t('auto_generate.gantt'),
                            t('auto_generate.gantt_desc'),
                            onAutoGantt
                        )}
                        {renderTile(
                            <FaStream />,
                            t('auto_generate.timeline'),
                            t('auto_generate.timeline_desc'),
                            onAutoTimeline
                        )}
                        {renderTile(
                            <FaFileImport />,
                            t('templates.import_md') || 'Import MD',
                            t('templates.import_md_desc') || 'Import Markdown from URL',
                            onImportMD
                        )}
                        {renderTile(
                            <FaFileWord />,
                            t('templates.import_docx') || 'Import Docx',
                            t('templates.import_docx_desc') || 'Import Word Document to Markdown',
                            onImportDocx
                        )}
                        {onImportPdf && renderTile(
                            <FaFilePdf />,
                            t('templates.import_pdf') || 'Import PDF',
                            t('templates.import_pdf_desc') || 'Import PDF Document to Markdown',
                            onImportPdf
                        )}
                        {renderTile(
                            <FaBolt />,
                            t('auto_generate.transfer_md') || 'Transfer MD',
                            t('auto_generate.transfer_md_desc') || 'Copy MD files between local and cloud',
                            onTransferMD
                        )}
                    </div>
                </div>

                <div className="modal-actions">
                    <button className="modal-button cancel-button" onClick={onClose}>
                        <FaTimes /> {t('actions.close')}
                    </button>
                </div>
            </div>
        </div>
    );
}
