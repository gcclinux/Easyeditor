import React from 'react';
import { FaBold, FaItalic, FaStrikethrough, FaCode, FaFileCode, FaLevelDownAlt, FaTimes, FaFont, FaEraser } from 'react-icons/fa';
import { LuHeading1, LuHeading2, LuHeading3, LuHeading4, LuHeading5, LuHeading6 } from "react-icons/lu";
import { useLanguage } from '../i18n/LanguageContext';
import './formattingModal.css';

type Props = {
    onInsertH1?: () => void;
    onInsertH2?: () => void;
    onInsertH3?: () => void;
    onInsertH4?: () => void;
    onInsertH5?: () => void;
    onInsertH6?: () => void;
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
    onInsertH1,
    onInsertH2,
    onInsertH3,
    onInsertH4,
    onInsertH5,
    onInsertH6,
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
        onClick?: () => void
    ) => {
        if (!onClick) return null;
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
                        {renderTile(<LuHeading1 />, 'headers.h1', 'headers.h1_desc', onInsertH1)}
                        {renderTile(<LuHeading2 />, 'headers.h2', 'headers.h2_desc', onInsertH2)}
                        {renderTile(<LuHeading3 />, 'headers.h3', 'headers.h3_desc', onInsertH3)}
                        {renderTile(<LuHeading4 />, 'headers.h4', 'headers.h4_desc', onInsertH4)}
                        {renderTile(<LuHeading5 />, 'headers.h5', 'headers.h5_desc', onInsertH5)}
                        {renderTile(<LuHeading6 />, 'headers.h6', 'headers.h6_desc', onInsertH6)}
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
