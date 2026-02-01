import React from 'react';
import { FaTable, FaTasks, FaColumns, FaTimes, FaRoad, FaGem } from 'react-icons/fa';
import { BsGrid3X3 } from "react-icons/bs";
import { useLanguage } from '../i18n/LanguageContext';
import './tablesModal.css';

type Props = {
    onInsertTemplate: (tpl: string) => void;
    onClose: () => void;
};

export default function TablesModal({ onInsertTemplate, onClose }: Props) {
    const { t } = useLanguage();

    const renderTile = (
        icon: React.ReactNode,
        titleKey: string,
        descKey: string,
        markdown: string
    ) => {
        return (
            <button
                className="tables-tile"
                onClick={() => {
                    onInsertTemplate(markdown);
                    onClose();
                }}
            >
                <div className="tables-tile-icon">
                    {icon}
                </div>
                <div className="tables-tile-title">{t(titleKey)}</div>
                <div className="tables-tile-desc">{t(descKey)}</div>
            </button>
        );
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content tables-modal" onClick={(e) => e.stopPropagation()}>
                <h2>
                    <FaTable /> {t('toolbar.tables')}
                </h2>

                <div className="tables-tiles-section">
                    <div className="tables-tiles-grid">
                        {renderTile(
                            <FaTable />,
                            'tables.2x2',
                            'tables.2x2_desc',
                            `| Header 1 | Header 2 |\n|----------|----------|\n| Cell 1   | Cell 2   |\n| Cell 3   | Cell 4   |\n\n`
                        )}
                        {renderTile(
                            <BsGrid3X3 />,
                            'tables.3x3',
                            'tables.3x3_desc',
                            `| Header 1 | Header 2 | Header 3 |\n|----------|----------|----------|\n| Cell 1   | Cell 2   | Cell 3   |\n| Cell 4   | Cell 5   | Cell 6   |\n| Cell 7   | Cell 8   | Cell 9   |\n\n`
                        )}
                        {renderTile(
                            <FaTasks />,
                            'tables.task_list',
                            'tables.task_list_desc',
                            `| Task | Status | Priority | Due Date |\n|------|--------|----------|----------|\n| Task 1 | In Progress | High | 2024-01-15 |\n| Task 2 | Completed | Medium | 2024-01-10 |\n| Task 3 | Pending | Low | 2024-01-20 |\n\n`
                        )}
                        {renderTile(
                            <FaColumns />,
                            'tables.comparison',
                            'tables.comparison_desc',
                            `| Feature | Option A | Option B | Option C |\n|---------|----------|----------|----------|\n| Price | $10 | $15 | $20 |\n| Quality | Good | Better | Best |\n| Support | Basic | Standard | Premium |\n\n`
                        )}
                        {renderTile(
                            <FaRoad />,
                            'tables.roadmap',
                            'tables.roadmap_desc',
                            `## 🚀 Q1 Product Development Roadmap\n\n| Status | Feature | Priority | Progress | Lead | Docs |\n| :--- | :--- | :---: | :--- | :---: | :---: |\n| 🟢 **Live** | AI Search Integration | \`High\` | 100% | 👩💻 | [📄](https://easyeditor.uk) |\n| 🟡 **Testing** | Biometric Auth | \`Med\` | 75% | 👨💻 | [📄](https://easyeditor.uk) |\n| 🔵 **Design** | Dark Mode 2.0 | \`Low\` | 30% | 🎨 | [🏗️](https://easyeditor.uk) |\n| 🔴 **Backlog** | Voice Commands | \`Low\` | 0% | 🎙️ | [🚫](https://easyeditor.uk) |\n\n`
                        )}
                        {renderTile(
                            <FaGem />,
                            'tables.premium',
                            'tables.premium_desc',
                            `## 💎 Premium Service Comparison\n\n| Capability | **Standard Plan** | **Enterprise Pro** | **Infrastructure** |\n| :--- | :--- | :--- | :--- |\n| **Global Reach** | 📍 5 Regions | 🌐 24+ Regions | \`High Availability\` |\n| **Uptime SLA** | \`99.9%\` | \`99.99%\` | 🛡️ Gold Standard |\n| **Key Features** | • SSO Integration<br>• Basic API<br>• Email Support | • Custom Tokens<br>• Webhooks<br>• 24/7 Phone | ⚡ Full Access |\n| **Monthly Cost** | **$49.00** | **$199.00** | [Contact Sales](https://easyeditor.co.uk) |\n| **Reliability** | ★★★★☆ | ★★★★★ | 📈 Unmatched |\n`
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
