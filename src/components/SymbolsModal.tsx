
import { FaTimes } from 'react-icons/fa';
import { VscSymbolKeyword } from "react-icons/vsc";
import { useLanguage } from '../i18n/LanguageContext';
import './symbolsModal.css';

type Props = {
    onInsertSymbol: (symbol: string) => void;
    onClose: () => void;
};

const SYMBOLS = [
    '∆', '∇', '∑', '√', '∞', '№', '∠', '⋀', '⋁', '∴',
    '∵', '∶', '∷', '∸', '∹', '⊢', '⊣', '⊤', '⊥', '©',
    '←', '↑', '→', '↓', '↔', '↕', '↖', '↗', '↘', '↙',
    '⇄', '⇅', '⇆', '⇈', '⇉', '⇊', '⇐', '⇑', '⇒', '⇓'
];

export default function SymbolsModal({
    onInsertSymbol,
    onClose
}: Props) {
    const { t } = useLanguage();

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content symbols-modal" onClick={(e) => e.stopPropagation()}>
                <h2>
                    <VscSymbolKeyword /> Symbols
                </h2>

                <div className="symbols-tiles-grid">
                    {SYMBOLS.map((symbol, index) => (
                        <div
                            key={index}
                            className="symbols-tile"
                            onClick={() => {
                                onInsertSymbol(symbol);
                                onClose();
                            }}
                        >
                            <span className="symbols-tile-content">{symbol}</span>
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
