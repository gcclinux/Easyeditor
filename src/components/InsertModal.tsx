import React from 'react';
import { FaCalendarAlt, FaLink, FaCheckSquare, FaRulerHorizontal, FaIndent, FaAngleDoubleRight, FaListUl, FaListOl, FaTimes, FaExternalLinkAlt, FaBookmark, FaMagic, FaEnvelope, FaPhone, FaAnchor, FaDownload, FaImage } from 'react-icons/fa';
import { MdOutlineInsertChartOutlined } from "react-icons/md";
import { useLanguage } from '../i18n/LanguageContext';
import './insertModal.css';

type Props = {
    onRuler: () => void;
    onIndent1: () => void;
    onIndent2: () => void;
    onList1: () => void;
    onList2: () => void;
    onInsertTemplate: (tpl: string) => void;
    onClose: () => void;
};

export default function InsertModal({
    onRuler,
    onIndent1,
    onIndent2,
    onList1,
    onList2,
    onInsertTemplate,
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
                className="insert-tile"
                onClick={() => {
                    onClick();
                    onClose();
                }}
            >
                <div className="insert-tile-icon">
                    {icon}
                </div>
                <div className="insert-tile-title">{t(titleKey)}</div>
                <div className="insert-tile-desc">{t(descKey)}</div>
            </button>
        );
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content insert-modal" onClick={(e) => e.stopPropagation()}>
                <h2>
                    <MdOutlineInsertChartOutlined /> {t('toolbar.insert')}
                </h2>

                <div className="insert-tiles-section">
                    <div className="insert-tiles-grid">
                        {renderTile(<FaCalendarAlt />, 'insert.date', 'insert.date_desc', () => {
                            const date = new Date();
                            const parts = date.toString().split(' ');
                            const time = date.toLocaleTimeString('en-US', { hour12: true });
                            const dayName = parts[0];
                            const month = parts[1];
                            const day = parts[2];
                            const year = parts[3];
                            const dateStr = `${dayName} ${month} ${day} ${time} GMT ${year}`;
                            onInsertTemplate(dateStr);
                        })}
                        {renderTile(<FaLink />, 'insert.link', 'insert.link_desc', () => {
                            onInsertTemplate('[EasyEditor HomePage](https://github.com/gcclinux/easyeditor)');
                        })}
                        {renderTile(<FaCheckSquare />, 'insert.checklist', 'insert.checklist_desc', () => {
                            onInsertTemplate('- [ ] This item is unchecked\n- [X] This item is checked\n');
                        })}
                        {renderTile(<FaRulerHorizontal />, 'insert.ruler', 'insert.ruler_desc', onRuler)}
                        {renderTile(<FaIndent />, 'insert.indent1', 'insert.indent1_desc', onIndent1)}
                        {renderTile(<FaAngleDoubleRight />, 'insert.indent2', 'insert.indent2_desc', onIndent2)}
                        {renderTile(<FaListUl />, 'insert.list1', 'insert.list1_desc', onList1)}
                        {renderTile(<FaListOl />, 'insert.list2', 'insert.list2_desc', onList2)}
                    </div>
                </div>

                <div className="insert-tiles-section">
                    <div className="insert-tiles-section-title">{t('toolbar.links')}</div>
                    <div className="insert-tiles-grid">
                        {renderTile(<FaExternalLinkAlt />, 'links.title', 'links.title_desc', () => {
                            onInsertTemplate('[Link text](https://example.com "Link title")\n\n');
                        })}
                        {renderTile(<FaBookmark />, 'links.reference', 'links.reference_desc', () => {
                            onInsertTemplate('[Link text][ref-name]\n\n[ref-name]: https://example.com "Optional title"\n\n');
                        })}
                        {renderTile(<FaMagic />, 'links.autolink', 'links.autolink_desc', () => {
                            onInsertTemplate('<https://example.com>\n\n');
                        })}
                        {renderTile(<FaEnvelope />, 'links.email', 'links.email_desc', () => {
                            onInsertTemplate('[Contact me](mailto:user@example.com)\n\n');
                        })}
                        {renderTile(<FaPhone />, 'links.phone', 'links.phone_desc', () => {
                            onInsertTemplate('[Call us](tel:+1234567890)\n\n');
                        })}
                        {renderTile(<FaAnchor />, 'links.internal', 'links.internal_desc', () => {
                            onInsertTemplate('[Go to section](#section-name)\n\n');
                        })}
                        {renderTile(<FaDownload />, 'links.download', 'links.download_desc', () => {
                            onInsertTemplate('[Download file](./path/to/file.pdf)\n\n');
                        })}
                        {renderTile(<FaImage />, 'links.markdown_img', 'links.markdown_img_desc', () => {
                            onInsertTemplate('#### *Markdown Image URL Example*\n\n[![GitHub Project](https://raw.githubusercontent.com/gcclinux/EasyEditor/refs/heads/main/public/easyeditor128.png "EasyEditor")](https://github.com/gcclinux/EasyEditor)\n\n');
                        })}
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
