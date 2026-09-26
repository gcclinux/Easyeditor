import { useState } from 'react';
import useEscapeKey from '../utils/useEscapeKey';
import './autoGenerator.css';

interface TimelineGeneratorProps {
    isOpen: boolean;
    onClose: () => void;
    onInsert: (timelineText: string) => void;
    showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

interface Event {
    id: number;
    name: string;
}

interface TimelinePeriod {
    id: number;
    name: string;
    events: Event[];
}

interface Section {
    id: number;
    name: string;
    timelines: TimelinePeriod[];
}

const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const getCurrentMonthYear = () => {
    const date = new Date();
    return {
        month: date.getMonth(),
        year: date.getFullYear() % 100 // Get last 2 digits
    };
};

const getNextMonthYear = (currentMonth: number, currentYear: number) => {
    if (currentMonth === 11) {
        return { month: 0, year: currentYear + 1 };
    }
    return { month: currentMonth + 1, year: currentYear };
};

export const TimelineGenerator: React.FC<TimelineGeneratorProps> = ({ isOpen, onClose, onInsert, showToast }) => {
    useEscapeKey(onClose, isOpen);
    const [currentDate, setCurrentDate] = useState(getCurrentMonthYear());

    const [sections, setSections] = useState<Section[]>([{
        id: 1,
        name: `Q${Math.floor(currentDate.month / 3) + 1} '${currentDate.year}`,
        timelines: [{
            id: 1,
            name: `${months[currentDate.month]} ${currentDate.year}`,
            events: [{ id: 1, name: 'Event Description' }]
        }]
    }]);

    const addSection = () => {
        const nextDate = getNextMonthYear(currentDate.month, currentDate.year);
        setCurrentDate(nextDate);

        const newSection = {
            id: sections.length + 1,
            name: `Q${Math.floor(nextDate.month / 3) + 1} '${nextDate.year}`,
            timelines: [{
                id: 1,
                name: `${months[nextDate.month]} ${nextDate.year}`,
                events: [{ id: 1, name: 'Event Description' }]
            }]
        };
        setSections([...sections, newSection]);
    };

    const addTimeline = (sectionIndex: number) => {
        const nextDate = getNextMonthYear(currentDate.month, currentDate.year);
        setCurrentDate(nextDate);

        const newTimeline = {
            id: sections[sectionIndex].timelines.length + 1,
            name: `${months[nextDate.month]} ${nextDate.year}`,
            events: [{ id: 1, name: 'Event Description' }]
        };
        const updatedSections = sections.map((section, i) => {
            if (i === sectionIndex) {
                return { ...section, timelines: [...section.timelines, newTimeline] };
            }
            return section;
        });
        setSections(updatedSections);
    };

    const addEvent = (sectionIndex: number, timelineIndex: number) => {
        const newEvent = {
            id: sections[sectionIndex].timelines[timelineIndex].events.length + 1,
            name: `Event ${sections[sectionIndex].timelines[timelineIndex].events.length + 1}`
        };
        const updatedSections = sections.map((section, i) => {
            if (i === sectionIndex) {
                const updatedTimelines = section.timelines.map((timeline, j) => {
                    if (j === timelineIndex) {
                        return { ...timeline, events: [...timeline.events, newEvent] };
                    }
                    return timeline;
                });
                return { ...section, timelines: updatedTimelines };
            }
            return section;
        });
        setSections(updatedSections);
    };

    const updateSection = (index: number, field: keyof Section, value: string) => {
        const updatedSections = sections.map((section, i) => {
            if (i === index) {
                return { ...section, [field]: value };
            }
            return section;
        });
        setSections(updatedSections);
    };

    const updateTimeline = (sectionIndex: number, timelineIndex: number, field: keyof TimelinePeriod, value: string) => {
        const updatedSections = sections.map((section, i) => {
            if (i === sectionIndex) {
                const updatedTimelines = section.timelines.map((timeline, j) => {
                    if (j === timelineIndex) {
                        return { ...timeline, [field]: value };
                    }
                    return timeline;
                });
                return { ...section, timelines: updatedTimelines };
            }
            return section;
        });
        setSections(updatedSections);
    };

    const updateEvent = (sectionIndex: number, timelineIndex: number, eventIndex: number, field: keyof Event, value: string) => {
        const updatedSections = sections.map((section, i) => {
            if (i === sectionIndex) {
                const updatedTimelines = section.timelines.map((timeline, j) => {
                    if (j === timelineIndex) {
                        const updatedEvents = timeline.events.map((event, k) => {
                            if (k === eventIndex) {
                                return { ...event, [field]: value };
                            }
                            return event;
                        });
                        return { ...timeline, events: updatedEvents };
                    }
                    return timeline;
                });
                return { ...section, timelines: updatedTimelines };
            }
            return section;
        });
        setSections(updatedSections);
    };

    const removeEvent = (sectionIndex: number, timePeridIndex: number, eventIndex: number) => {
        const section = sections[sectionIndex];
        const timelPeriod = section.timelines[timePeridIndex];
        if (timelPeriod.events.length > 1) {
            const updatedSections = sections.map((sect, i) => {
                if (i === sectionIndex) {
                    const updatedTimelines = sect.timelines.map((timeline, j) => {
                        if (j === timePeridIndex) {
                            const updatedEvents = timeline.events.filter((_, k) => k !== eventIndex);
                            return { ...timeline, events: updatedEvents };
                        }
                        return timeline;
                    });
                    return { ...sect, timelines: updatedTimelines };
                }
                return sect;
            });
            setSections(updatedSections);
        } else {
            showToast('You must have at least one event in a timeline', 'warning');
        }
    }

    const removeSection = (sectionIndex: number) => {
        const updatedSections = sections.filter((_, i) => i !== sectionIndex);
        setSections(updatedSections);
    };

    const removeTimeline = (sectionIndex: number, timelineIndex: number) => {
        const updatedSections = sections.map((section, i) => {
            if (i === sectionIndex) {
                const updatedTimelines = section.timelines.filter((_, j) => j !== timelineIndex);
                return { ...section, timelines: updatedTimelines };
            }
            return section;
        });
        setSections(updatedSections);
    };

    const createTimeline = () => {
        let timeline = '```mermaid\ntimeline\n';

        sections.forEach((section) => {
            timeline += `section ${section.name}\n`;

            section.timelines.forEach((TimelinePeriod) => {
                const eventTexts = TimelinePeriod.events.map(event => event.name).join(' : ');
                timeline += `    ${TimelinePeriod.name} : ${eventTexts}\n`;
            });
        });

        timeline += '```';
        return timeline;
    };

    return isOpen ? (
        <div className='modal-overlay'>
            <div className='time-modal-content'>
                <div className='time-headers-section'>
                    <h2>Mermaid Timeline Generator</h2>
                </div>
                <div className='time-generator-body'>
                    <div className='time-generator-sections'>
                        {sections.map((section, i) => (
                            <div key={section.id} className='time-generator-section'>
                                <div className='time-layout-container'>
                                    <div className='time-left-column'>
                                        <div className='time-input-stack'>
                                            <input
                                                type='text'
                                                value={section.name}
                                                onChange={(e) => updateSection(i, 'name', e.target.value)}
                                                placeholder='Section Name'
                                                className='time-input-section'
                                            />
                                            <button onClick={() => removeSection(i)}>Remove Section</button>
                                        </div>
                                        {section.timelines.map((TimelinePeriod, j) => (
                                            <div key={TimelinePeriod.id} className='time-input-stack'>
                                                <input
                                                    type='text'
                                                    value={TimelinePeriod.name}
                                                    onChange={(e) => updateTimeline(i, j, 'name', e.target.value)}
                                                    placeholder='Timeline Name'
                                                    className='time-input-timeline'
                                                />
                                                <button onClick={() => removeTimeline(i, j)}>Remove Timeline</button>
                                            </div>
                                        ))}
                                    </div>
                                    <div className='time-right-column'>
                                        {section.timelines.map((TimelinePeriod, j) =>
                                            TimelinePeriod.events.map((event, k) => (
                                                <div key={event.id} className='time-event-row'>
                                                    <textarea
                                                        value={event.name}
                                                        onChange={(e) => updateEvent(i, j, k, 'name', e.target.value)}
                                                        placeholder='Event Description'
                                                        className='time-input time-textarea-large'
                                                    />
                                                    <button onClick={() => removeEvent(i, j, k)}>Remove Event</button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className='time-generator-buttons'>
                        <button onClick={addSection}>New Section</button>
                        <button onClick={() => addTimeline(sections.length - 1)}>New Timeline</button>
                        <button onClick={() => addEvent(sections.length - 1, sections[sections.length - 1]?.timelines.length - 1)}>New Event</button>

                    </div>
                </div>
                <div className='time-generator-buttons botton-hover'>
                    <button onClick={onClose}>Cancel</button>
                    <button onClick={() => onInsert(createTimeline())}>Insert Timeline</button>
                </div>
            </div>
        </div>
    ) : null;
};

export default TimelineGenerator;