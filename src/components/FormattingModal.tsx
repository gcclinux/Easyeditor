import React from 'react';
import { FaBold, FaItalic, FaStrikethrough, FaCode, FaFileCode, FaLevelDownAlt, FaTimes, FaFont, FaEraser } from 'react-icons/fa';
import { useLanguage } from '../i18n/LanguageContext';
import './formattingModal.css';

type Props = {
    onCodeLine: () => void;
    onCodeBlock: () => void;
    onBold: () => void;
    onItalic: () => void;
    onStrike: () => void;
    onNewLine: () => void;
    onClearText: () => void;
    onClose: () => void;
};

export default function FormattingModal({
    onCodeLine,
    onCodeBlock,
    onBold,
    onItalic,
    onStrike,
    onNewLine,
    onClearText,
    onClose
}: Props) {
    const { t } = useLanguage();

    const renderTile = (
        icon: React.ReactNode,
        titleKey: string,
        descKey: string,
        onClick: () => void
    ) => {
        return (
            <button
                className="formatting-tile"
                onClick={() => {
                    onClick();
                    onClose();
                }}
            >
                <div className="formatting-tile-icon">
                    {icon}
                </div>
                <div className="formatting-tile-title">{t(titleKey)}</div>
                <div className="formatting-tile-desc">{t(descKey)}</div>
            </button>
        );
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content formatting-modal" onClick={(e) => e.stopPropagation()}>
                <h2>
                    <FaFont /> {t('toolbar.formatting')}
                </h2>

                <div className="formatting-tiles-section">
                    <div className="formatting-tiles-grid">
                        {renderTile(<FaBold />, 'format.bold', 'format.bold_desc', onBold)}
                        {renderTile(<FaItalic />, 'format.italic', 'format.italic_desc', onItalic)}
                        {renderTile(<FaStrikethrough />, 'format.strike', 'format.strike_desc', onStrike)}
                        {renderTile(<FaCode />, 'format.codeline', 'format.codeline_desc', onCodeLine)}
                        {renderTile(<FaFileCode />, 'format.codeblock', 'format.codeblock_desc', onCodeBlock)}
                        {renderTile(<FaLevelDownAlt />, 'format.newline', 'format.newline_desc', onNewLine)}
                        {renderTile(<FaEraser />, 'format.clear_text', 'format.clear_text_desc', onClearText)}
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
