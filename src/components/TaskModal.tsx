import React from 'react';
import { FaTimes } from 'react-icons/fa';
import { GoTasklist } from "react-icons/go";
import { useLanguage } from '../i18n/LanguageContext';
import taskTemplates from '../templates/tasks';
import './taskModal.css';

type Props = {
    onInsertTask: (markdown: string) => void;
    onClose: () => void;
};

export default function TaskModal({
    onInsertTask,
    onClose
}: Props) {
    const { t } = useLanguage();

    const renderTile = (
        icon: React.ReactNode,
        titleKey: string,
        descKey: string,
        markdown: string
    ) => {
        return (
            <button
                className="task-tile"
                onClick={() => {
                    onInsertTask(markdown);
                    onClose();
                }}
            >
                <div className="task-tile-icon">
                    {icon}
                </div>
                <div className="task-tile-title">{t(titleKey)}</div>
                <div className="task-tile-desc">{t(descKey)}</div>
            </button>
        );
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content task-modal" onClick={(e) => e.stopPropagation()}>
                <h2>
                    <GoTasklist /> {t('menu.tasks')}
                </h2>
                <p className="task-modal-subtitle">{t('modals.tasks.subtitle')}</p>

                <div className="task-tiles-section">
                    <div className="task-tiles-section-title">{t('modals.tasks.section_title')}</div>
                    <div className="task-tiles-grid">
                        {taskTemplates.map((tpl) => (
                            <React.Fragment key={tpl.id}>
                                {renderTile(
                                    <GoTasklist />,
                                    `templates.tasks.${tpl.id}`,
                                    `templates.tasks.${tpl.id}_desc`,
                                    tpl.markdown + '\n\n'
                                )}
                            </React.Fragment>
                        ))}
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
