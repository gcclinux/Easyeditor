import React from 'react';
import { FaCopy, FaTimes } from 'react-icons/fa';
import {
    BsJournalBookmarkFill,
    BsKanban,
    BsClipboard2Check,
    BsBook,
    BsMap,
    BsActivity,
    BsBug,
    BsDiagram3,
    BsCodeSquare,
    BsCloud
} from "react-icons/bs";
import { useLanguage } from '../i18n/LanguageContext';
import { buildDailyJournalTemplate } from '../templates/dailyJournal';
import { buildMeetingNotesTemplate } from '../templates/meetingNotes';
import { buildProjectPlanTemplate } from '../templates/projectPlan';
import { buildStudyNotesTemplate } from '../templates/studyNotes';
import { buildTravelLogsTemplate } from '../templates/travelLogs';
import { buildWorkoutLogTemplate } from '../templates/workoutLog';
import { buildBugReportTemplate } from '../templates/bugReport';
import { buildDiagramExamplesTemplate } from '../templates/diagramExamples';
import { buildDiagramASCIITemplate } from '../templates/diagramASCII';
import { buildKanbanDiagramTemplate } from '../templates/kanbanDiagram';
import { buildAppDevAwsPostgresTemplate } from '../templates/appDevAwsPostgres';
import './templatesModal.css';

type Props = {
    onInsertTemplate: (tpl: string) => void;
    onClose: () => void;
};

export default function TemplatesModal({ onInsertTemplate, onClose }: Props) {
    const { t } = useLanguage();

    const renderTile = (
        icon: React.ReactNode,
        titleKey: string,
        descKey: string,
        templateBuilder: () => string
    ) => {
        return (
            <button
                className="templates-tile"
                onClick={() => {
                    const tpl = templateBuilder();
                    onInsertTemplate(tpl + '\n\n');
                    onClose();
                }}
            >
                <div className="templates-tile-icon">
                    {icon}
                </div>
                <div className="templates-tile-title">{t(titleKey)}</div>
                <div className="templates-tile-desc">{t(descKey)}</div>
            </button>
        );
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content templates-modal" onClick={(e) => e.stopPropagation()}>
                <h2>
                    <FaCopy /> {t('menu.templates')}
                </h2>

                <div className="templates-tiles-section">
                    <div className="templates-tiles-grid">
                        {renderTile(
                            <BsJournalBookmarkFill />,
                            'templates.daily_journal',
                            'templates.daily_journal_desc',
                            () => buildDailyJournalTemplate(new Date())
                        )}
                        {renderTile(
                            <BsKanban />,
                            'templates.meeting_notes',
                            'templates.meeting_notes_desc',
                            () => buildMeetingNotesTemplate(new Date())
                        )}
                        {renderTile(
                            <BsClipboard2Check />,
                            'templates.project_plan',
                            'templates.project_plan_desc',
                            () => buildProjectPlanTemplate(new Date())
                        )}
                        {renderTile(
                            <BsBook />,
                            'templates.study_notes',
                            'templates.study_notes_desc',
                            () => buildStudyNotesTemplate(new Date())
                        )}
                        {renderTile(
                            <BsMap />,
                            'templates.travel_log',
                            'templates.travel_log_desc',
                            () => buildTravelLogsTemplate(new Date())
                        )}
                        {renderTile(
                            <BsActivity />,
                            'templates.workout_log',
                            'templates.workout_log_desc',
                            () => buildWorkoutLogTemplate(new Date())
                        )}
                        {renderTile(
                            <BsBug />,
                            'templates.bug_report',
                            'templates.bug_report_desc',
                            () => buildBugReportTemplate(new Date())
                        )}
                        {renderTile(
                            <BsDiagram3 />,
                            'templates.diagram_examples',
                            'templates.diagram_examples_desc',
                            () => buildDiagramExamplesTemplate()
                        )}
                        {renderTile(
                            <BsCodeSquare />,
                            'templates.ascii_diagram',
                            'templates.ascii_diagram_desc',
                            () => buildDiagramASCIITemplate()
                        )}
                        {renderTile(
                            <BsKanban />,
                            'templates.kanban_diagram',
                            'templates.kanban_diagram_desc',
                            () => buildKanbanDiagramTemplate()
                        )}
                        {renderTile(
                            <BsCloud />,
                            'templates.app_dev_aws_postgres',
                            'templates.app_dev_aws_postgres_desc',
                            () => buildAppDevAwsPostgresTemplate()
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
