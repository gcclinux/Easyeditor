import React from 'react';
import { FaTimes } from 'react-icons/fa';
import { AiOutlineLayout } from "react-icons/ai";
import {
    BsBoundingBox,
    BsArrowRightSquare,
    BsDiagram3,
    BsArrowsMove,
    BsPuzzle,
    BsLightningCharge,
    BsSearch,
    BsDatabase
} from 'react-icons/bs';
import { useLanguage } from '../i18n/LanguageContext';
import './umlModal.css';

type Props = {
    onClassDiagram: () => void;
    onSequenceDiagram: () => void;
    onUseCaseDiagram: () => void;
    onActivityDiagram: () => void;
    onComponentDiagram: () => void;
    onStateDiagram: () => void;
    onProcessEliminationDiagram: () => void;
    onDatabaseReplicationDiagram: () => void;
    onClose: () => void;
};

export default function UMLModal({
    onClassDiagram,
    onSequenceDiagram,
    onUseCaseDiagram,
    onActivityDiagram,
    onComponentDiagram,
    onStateDiagram,
    onProcessEliminationDiagram,
    onDatabaseReplicationDiagram,
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
                className="uml-tile"
                onClick={() => {
                    onClick();
                    onClose();
                }}
            >
                <div className="uml-tile-icon">
                    {icon}
                </div>
                <div className="uml-tile-title">{t(titleKey)}</div>
                <div className="uml-tile-desc">{t(descKey)}</div>
            </button>
        );
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content uml-modal" onClick={(e) => e.stopPropagation()}>
                <h2>
                    <AiOutlineLayout /> UML
                </h2>

                <div className="uml-tiles-section">
                    <div className="uml-tiles-grid">
                        {renderTile(
                            <BsBoundingBox />,
                            'uml.class',
                            'uml.class_desc',
                            onClassDiagram
                        )}
                        {renderTile(
                            <BsArrowRightSquare />,
                            'uml.sequence',
                            'uml.sequence_desc',
                            onSequenceDiagram
                        )}
                        {renderTile(
                            <BsDiagram3 />,
                            'uml.usecase',
                            'uml.usecase_desc',
                            onUseCaseDiagram
                        )}
                        {renderTile(
                            <BsArrowsMove />,
                            'uml.activity',
                            'uml.activity_desc',
                            onActivityDiagram
                        )}
                        {renderTile(
                            <BsPuzzle />,
                            'uml.component',
                            'uml.component_desc',
                            onComponentDiagram
                        )}
                        {renderTile(
                            <BsLightningCharge />,
                            'uml.state',
                            'uml.state_desc',
                            onStateDiagram
                        )}
                        {renderTile(
                            <BsSearch />,
                            'uml.process_elimination',
                            'uml.process_elimination_desc',
                            onProcessEliminationDiagram
                        )}
                        {renderTile(
                            <BsDatabase />,
                            'uml.db_replication',
                            'uml.db_replication_desc',
                            onDatabaseReplicationDiagram
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
