import React from 'react';
import {
    FaTimes,
    FaImage,
    FaCheckCircle,
    FaTimesCircle,
    FaExclamationTriangle,
    FaStar,
    FaFire,
    FaLightbulb,
    FaEdit,
    FaRocket,
    FaBullseye,
    FaChartBar,
    FaWrench,
    FaCalendarAlt,
    FaCircle,
    FaMagic,
    FaGlassCheers,
    FaThumbsUp,
    FaThumbsDown,
    FaMoneyBillWave,
    FaClock
} from 'react-icons/fa';
import { useLanguage } from '../i18n/LanguageContext';
import './iconsModal.css';

type IconItem = {
    icon: string;
    label: string;
    component: React.ReactNode;
};

type Props = {
    onInsertIcon: (icon: string) => void;
    onClose: () => void;
};

const ICON_CATEGORIES: { name: string; icons: IconItem[] }[] = [
    {
        name: "status",
        icons: [
            { icon: "✅", label: "check", component: <FaCheckCircle color="#4ade80" /> },
            { icon: "❌", label: "cross", component: <FaTimesCircle color="#f87171" /> },
            { icon: "⚠️", label: "warning", component: <FaExclamationTriangle color="#facc15" /> },
            { icon: "⭐", label: "star", component: <FaStar color="#fbbf24" /> },
            { icon: "🔥", label: "fire", component: <FaFire color="#f97316" /> },
            { icon: "💡", label: "bulb", component: <FaLightbulb color="#facc15" /> }
        ]
    },
    {
        name: "actions",
        icons: [
            { icon: "📝", label: "memo", component: <FaEdit color="#38bdf8" /> },
            { icon: "🚀", label: "rocket", component: <FaRocket color="#a8a29e" /> },
            { icon: "🎯", label: "target", component: <FaBullseye color="#f43f5e" /> },
            { icon: "📊", label: "chart", component: <FaChartBar color="#818cf8" /> },
            { icon: "🔧", label: "wrench", component: <FaWrench color="#9ca3af" /> },
            { icon: "📅", label: "calendar", component: <FaCalendarAlt color="#60a5fa" /> }
        ]
    },
    {
        name: "colors",
        icons: [
            { icon: "🔵", label: "blue", component: <FaCircle color="#3b82f6" /> },
            { icon: "🟢", label: "green", component: <FaCircle color="#22c55e" /> },
            { icon: "🔴", label: "red", component: <FaCircle color="#ef4444" /> },
            { icon: "🟡", label: "yellow", component: <FaCircle color="#eab308" /> },
            { icon: "🟣", label: "purple", component: <FaCircle color="#a855f7" /> },
            { icon: "🟠", label: "orange", component: <FaCircle color="#f97316" /> }
        ]
    },
    {
        name: "symbols",
        icons: [
            { icon: "✨", label: "sparkles", component: <FaMagic color="#e879f9" /> },
            { icon: "🎉", label: "party", component: <FaGlassCheers color="#ec4899" /> },
            { icon: "👍", label: "thumbs_up", component: <FaThumbsUp color="#60a5fa" /> },
            { icon: "👎", label: "thumbs_down", component: <FaThumbsDown color="#ef4444" /> },
            { icon: "💰", label: "money", component: <FaMoneyBillWave color="#22c55e" /> },
            { icon: "⏰", label: "clock", component: <FaClock color="#94a3b8" /> }
        ]
    }
];

export default function IconsModal({
    onInsertIcon,
    onClose
}: Props) {
    const { t } = useLanguage();

    // Flatten all icons into a single list
    const allIcons = ICON_CATEGORIES.flatMap(cat => cat.icons);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content icons-modal" onClick={(e) => e.stopPropagation()}>
                <h2>
                    <FaImage /> Icons
                </h2>

                <div className="icons-tiles-grid">
                    {allIcons.map((item, index) => (
                        <div
                            key={index}
                            className="icons-tile"
                            onClick={() => {
                                onInsertIcon(item.icon);
                                onClose();
                            }}
                            title={t(`icons.labels.${item.label}`)}
                        >
                            <span className="icons-tile-content" style={{ fontSize: '1.5em', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{item.component}</span>
                            <span className="icons-tile-label">{t(`icons.labels.${item.label}`)}</span>
                        </div>
                    ))}
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
