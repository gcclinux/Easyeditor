import React from 'react';
import { FaTimes } from 'react-icons/fa';
import { SiMermaid } from 'react-icons/si';
import {
    BsSignpostSplit,
    BsDiagram3,
    BsBarChartSteps,
    BsGraphDown,
    BsDatabase,
    BsClockHistory,
    BsBoundingBox,
    BsGit,
    BsGrid
} from 'react-icons/bs';
import { useLanguage } from '../i18n/LanguageContext';
import './mermaidModal.css';

type Props = {
    onJourney: () => void;
    onFlowchart: () => void;
    onGantt: () => void;
    onGraphTD: () => void;
    onErDiag: () => void;
    onTimeLine: () => void;
    onClassDiag: () => void;
    onGitGraph: () => void;
    onBlock: () => void;
    onClose: () => void;
};

export default function MermaidModal({
    onJourney,
    onFlowchart,
    onGantt,
    onGraphTD,
    onErDiag,
    onTimeLine,
    onClassDiag,
    onGitGraph,
    onBlock,
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
                className="mermaid-tile"
                onClick={() => {
                    onClick();
                    onClose();
                }}
            >
                <div className="mermaid-tile-icon">
                    {icon}
                </div>
                <div className="mermaid-tile-title">{t(titleKey)}</div>
                <div className="mermaid-tile-desc">{t(descKey)}</div>
            </button>
        );
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content mermaid-modal" onClick={(e) => e.stopPropagation()}>
                <h2>
                    <SiMermaid /> Mermaid
                </h2>

                <div className="mermaid-tiles-section">
                    <div className="mermaid-tiles-grid">
                        {renderTile(
                            <BsSignpostSplit />,
                            'mermaid.journey',
                            'mermaid.journey_desc',
                            onJourney
                        )}
                        {renderTile(
                            <BsDiagram3 />,
                            'mermaid.flowchart',
                            'mermaid.flowchart_desc',
                            onFlowchart
                        )}
                        {renderTile(
                            <BsBarChartSteps />,
                            'mermaid.gantt',
                            'mermaid.gantt_desc',
                            onGantt
                        )}
                        {renderTile(
                            <BsGraphDown />,
                            'mermaid.graphtd',
                            'mermaid.graphtd_desc',
                            onGraphTD
                        )}
                        {renderTile(
                            <BsDatabase />,
                            'mermaid.erdiag',
                            'mermaid.erdiag_desc',
                            onErDiag
                        )}
                        {renderTile(
                            <BsClockHistory />,
                            'mermaid.timeline',
                            'mermaid.timeline_desc',
                            onTimeLine
                        )}
                        {renderTile(
                            <BsGit />,
                            'mermaid.gitgraph',
                            'mermaid.gitgraph_desc',
                            onGitGraph
                        )}
                        {renderTile(
                            <BsBoundingBox />,
                            'mermaid.classdiag',
                            'mermaid.classdiag_desc',
                            onClassDiag
                        )}
                        {renderTile(
                            <BsGrid />,
                            'mermaid.block',
                            'mermaid.block_desc',
                            onBlock
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
