import { FaTimes, FaImage } from 'react-icons/fa';
import { useLanguage } from '../i18n/LanguageContext';
import './iconsModal.css';

type IconItem = {
    icon: string;
    label: string;
};

type Props = {
    onInsertIcon: (icon: string) => void;
    onClose: () => void;
};

const ICON_CATEGORIES: { name: string; icons: IconItem[] }[] = [
    {
        name: "status",
        icons: [
            { icon: "✅", label: "check" },
            { icon: "❌", label: "cross" },
            { icon: "⚠️", label: "warning" },
            { icon: "⭐", label: "star" },
            { icon: "🔥", label: "fire" },
            { icon: "💡", label: "bulb" }
        ]
    },
    {
        name: "actions",
        icons: [
            { icon: "📝", label: "memo" },
            { icon: "🚀", label: "rocket" },
            { icon: "🎯", label: "target" },
            { icon: "📊", label: "chart" },
            { icon: "🔧", label: "wrench" },
            { icon: "📅", label: "calendar" }
        ]
    },
    {
        name: "colors",
        icons: [
            { icon: "🔵", label: "blue" },
            { icon: "🟢", label: "green" },
            { icon: "🔴", label: "red" },
            { icon: "🟡", label: "yellow" },
            { icon: "🟣", label: "purple" },
            { icon: "🟠", label: "orange" }
        ]
    },
    {
        name: "symbols",
        icons: [
            { icon: "✨", label: "sparkles" },
            { icon: "🎉", label: "party" },
            { icon: "👍", label: "thumbs_up" },
            { icon: "👎", label: "thumbs_down" },
            { icon: "💰", label: "money" },
            { icon: "⏰", label: "clock" }
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
                            <span className="icons-tile-content">{item.icon}</span>
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
