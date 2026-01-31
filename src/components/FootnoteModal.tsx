import React from 'react';
import { FaStickyNote, FaLayerGroup, FaSortNumericDown, FaGraduationCap, FaTimes } from 'react-icons/fa';
import { useLanguage } from '../i18n/LanguageContext';
import './footnoteModal.css';

type Props = {
    onInsertTemplate: (tpl: string) => void;
    onClose: () => void;
};

export default function FootnoteModal({ onInsertTemplate, onClose }: Props) {
    const { t } = useLanguage();

    const renderTile = (
        icon: React.ReactNode,
        titleKey: string,
        descKey: string,
        markdown: string
    ) => {
        return (
            <button
                className="footnote-tile"
                onClick={() => {
                    onInsertTemplate(markdown);
                    onClose();
                }}
            >
                <div className="footnote-tile-icon">
                    {icon}
                </div>
                <div className="footnote-tile-title">{t(titleKey)}</div>
                <div className="footnote-tile-desc">{t(descKey)}</div>
            </button>
        );
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content footnote-modal" onClick={(e) => e.stopPropagation()}>
                <h2>
                    <FaStickyNote /> {t('toolbar.footnotes')}
                </h2>

                <div className="footnote-tiles-section">
                    <div className="footnote-tiles-grid">
                        {renderTile(
                            <FaStickyNote />,
                            'footer.simple',
                            'footer.simple_desc',
                            'This is a sentence with a footnote[^1].\n\n[^1]: This is the footnote content.\n\n'
                        )}
                        {renderTile(
                            <FaLayerGroup />,
                            'footer.multiple',
                            'footer.multiple_desc',
                            'First footnote[^1] and second footnote[^2].\n\n[^1]: First footnote content.\n[^2]: Second footnote content.\n\n'
                        )}
                        {renderTile(
                            <FaSortNumericDown />,
                            'footer.numbered',
                            'footer.numbered_desc',
                            'Reference with number[^note1].\n\n[^note1]: Detailed explanation or source.\n\n'
                        )}
                        {renderTile(
                            <FaGraduationCap />,
                            'footer.academic',
                            'footer.academic_desc',
                            'According to research[^research2025].\n\n[^research2025]: Smith, J. (2025). *Academic Paper Title*. Journal Name, 17(2), 123-140.\n\n'
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
