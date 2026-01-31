import React from 'react';
import {
    FaLink,
    FaExternalLinkAlt,
    FaBookmark,
    FaMagic,
    FaEnvelope,
    FaPhone,
    FaAnchor,
    FaDownload,
    FaImage,
    FaTimes
} from 'react-icons/fa';
import { useLanguage } from '../i18n/LanguageContext';
import './linksModal.css';

type Props = {
    onInsertTemplate: (tpl: string) => void;
    onClose: () => void;
};

export default function LinksModal({ onInsertTemplate, onClose }: Props) {
    const { t } = useLanguage();

    const renderTile = (
        icon: React.ReactNode,
        titleKey: string,
        descKey: string,
        markdown: string
    ) => {
        return (
            <button
                className="links-tile"
                onClick={() => {
                    onInsertTemplate(markdown);
                    onClose();
                }}
            >
                <div className="links-tile-icon">
                    {icon}
                </div>
                <div className="links-tile-title">{t(titleKey)}</div>
                <div className="links-tile-desc">{t(descKey)}</div>
            </button>
        );
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content links-modal" onClick={(e) => e.stopPropagation()}>
                <h2>
                    <FaLink /> {t('toolbar.links')}
                </h2>

                <div className="links-tiles-section">
                    <div className="links-tiles-grid">
                        {renderTile(
                            <FaLink />,
                            'links.inline',
                            'links.inline_desc',
                            '[Link text](https://example.com)\n\n'
                        )}
                        {renderTile(
                            <FaExternalLinkAlt />,
                            'links.title',
                            'links.title_desc',
                            '[Link text](https://example.com "Link title")\n\n'
                        )}
                        {renderTile(
                            <FaBookmark />,
                            'links.reference',
                            'links.reference_desc',
                            '[Link text][ref-name]\n\n[ref-name]: https://example.com "Optional title"\n\n'
                        )}
                        {renderTile(
                            <FaMagic />,
                            'links.autolink',
                            'links.autolink_desc',
                            '<https://example.com>\n\n'
                        )}
                        {renderTile(
                            <FaEnvelope />,
                            'links.email',
                            'links.email_desc',
                            '[Contact me](mailto:user@example.com)\n\n'
                        )}
                        {renderTile(
                            <FaPhone />,
                            'links.phone',
                            'links.phone_desc',
                            '[Call us](tel:+1234567890)\n\n'
                        )}
                        {renderTile(
                            <FaAnchor />,
                            'links.internal',
                            'links.internal_desc',
                            '[Go to section](#section-name)\n\n'
                        )}
                        {renderTile(
                            <FaDownload />,
                            'links.download',
                            'links.download_desc',
                            '[Download file](./path/to/file.pdf)\n\n'
                        )}
                        {renderTile(
                            <FaImage />,
                            'links.markdown_img',
                            'links.markdown_img_desc',
                            '#### *Markdown Image URL Example*\n\n[![GitHub Project](https://raw.githubusercontent.com/gcclinux/EasyEditor/refs/heads/main/public/easyeditor128.png "EasyEditor")](https://github.com/gcclinux/EasyEditor)\n\n'
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
