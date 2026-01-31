import React from 'react';
import { FaImage, FaLink, FaExternalLinkAlt, FaStickyNote, FaTimes } from 'react-icons/fa';
import { useLanguage } from '../i18n/LanguageContext';
import './imagesModal.css';

type Props = {
    onInsertTemplate: (tpl: string) => void;
    onClose: () => void;
};

export default function ImagesModal({ onInsertTemplate, onClose }: Props) {
    const { t } = useLanguage();

    const renderTile = (
        icon: React.ReactNode,
        titleKey: string,
        descKey: string,
        tpl: string
    ) => {
        return (
            <button
                className="images-tile"
                onClick={() => {
                    onInsertTemplate(tpl);
                    onClose();
                }}
            >
                <div className="images-tile-icon">
                    {icon}
                </div>
                <div className="images-tile-title">{t(titleKey)}</div>
                <div className="images-tile-desc">{t(descKey)}</div>
            </button>
        );
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content images-modal" onClick={(e) => e.stopPropagation()}>
                <h2>
                    <FaImage /> {t('toolbar.images')}
                </h2>

                <div className="images-tiles-section">
                    <div className="images-tiles-grid">
                        {renderTile(
                            <FaImage />,
                            'images.image',
                            'images.inline',
                            '![EasyEditor](https://raw.githubusercontent.com/gcclinux/EasyEditor/refs/heads/main/public/easyeditor128.png)\n\n'
                        )}
                        {renderTile(
                            <FaLink />,
                            'images.image_link',
                            'images.image_link_desc',
                            '[![EasyEditor](https://raw.githubusercontent.com/gcclinux/EasyEditor/refs/heads/main/public/easyeditor128.png)](https://github.com/gcclinux/easyeditor)\n\n'
                        )}
                        {renderTile(
                            <FaStickyNote />,
                            'images.figure',
                            'images.figure_desc',
                            '![](https://raw.githubusercontent.com/gcclinux/EasyEditor/refs/heads/main/public/easyeditor128.png)\n\n*Figure: caption*\n\n'
                        )}
                        {renderTile(
                            <FaExternalLinkAlt />,
                            'images.link_new_tab',
                            'images.link_new_tab_desc',
                            '[![EasyEditor](https://raw.githubusercontent.com/gcclinux/EasyEditor/refs/heads/main/public/easyeditor128.png)](https://github.com/gcclinux/easyeditor "EasyEditor HomePage")\n\n'
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
