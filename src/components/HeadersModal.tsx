import React from 'react';
import { FaHeading, FaTimes } from 'react-icons/fa';
import { LuHeading1, LuHeading2, LuHeading3, LuHeading4, LuHeading5, LuHeading6 } from "react-icons/lu";
import { useLanguage } from '../i18n/LanguageContext';
import './headersModal.css';

type Props = {
    onInsertH1: () => void;
    onInsertH2: () => void;
    onInsertH3: () => void;
    onInsertH4: () => void;
    onInsertH5: () => void;
    onInsertH6: () => void;
    onClose: () => void;
};

export default function HeadersModal({
    onInsertH1,
    onInsertH2,
    onInsertH3,
    onInsertH4,
    onInsertH5,
    onInsertH6,
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
                className="headers-tile"
                onClick={() => {
                    onClick();
                    onClose();
                }}
            >
                <div className="headers-tile-icon">
                    {icon}
                </div>
                <div className="headers-tile-title">{t(titleKey)}</div>
                <div className="headers-tile-desc">{t(descKey)}</div>
            </button>
        );
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content headers-modal" onClick={(e) => e.stopPropagation()}>
                <h2>
                    <FaHeading /> {t('toolbar.headers')}
                </h2>
                {/* <p className="headers-modal-subtitle">Select a header level</p> */}

                <div className="headers-tiles-section">
                    {/* <div className="headers-tiles-section-title">Header Levels</div> */}
                    <div className="headers-tiles-grid">
                        {renderTile(<LuHeading1 />, 'headers.h1', 'headers.h1_desc', onInsertH1)}
                        {renderTile(<LuHeading2 />, 'headers.h2', 'headers.h2_desc', onInsertH2)}
                        {renderTile(<LuHeading3 />, 'headers.h3', 'headers.h3_desc', onInsertH3)}
                        {renderTile(<LuHeading4 />, 'headers.h4', 'headers.h4_desc', onInsertH4)}
                        {renderTile(<LuHeading5 />, 'headers.h5', 'headers.h5_desc', onInsertH5)}
                        {renderTile(<LuHeading6 />, 'headers.h6', 'headers.h6_desc', onInsertH6)}
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
