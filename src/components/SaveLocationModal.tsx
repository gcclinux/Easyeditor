import React from 'react';
import { FaSave, FaFolder, FaGoogleDrive, FaDropbox, FaTimes } from 'react-icons/fa';
import './SaveLocationModal.css';

interface Provider {
    name: string;
    displayName: string;
    icon?: string;
}

interface SaveLocationModalProps {
    open: boolean;
    onClose: () => void;
    onSelectLocal: () => void;
    onSelectProvider: (provider: string) => void;
    connectedProviders: Provider[];
}

const SaveLocationModal: React.FC<SaveLocationModalProps> = ({
    open,
    onClose,
    onSelectLocal,
    onSelectProvider,
    connectedProviders
}) => {
    if (!open) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content save-location-modal" onClick={(e) => e.stopPropagation()}>
                <h2>
                    <FaSave />
                    Save As...
                </h2>

                <div className="save-location-subtitle">
                    Choose where to save your file
                </div>

                <div className="save-location-body">
                    <div className="save-location-grid">
                        <button className="save-location-tile" onClick={onSelectLocal}>
                            <div className="save-location-tile-icon local">
                                <FaFolder />
                            </div>
                            <div className="save-location-tile-title">Local Filesystem</div>
                            <div className="save-location-tile-desc">Save to your computer</div>
                        </button>

                        {connectedProviders.map(provider => (
                            <button
                                key={provider.name}
                                className="save-location-tile"
                                onClick={() => onSelectProvider(provider.name)}
                            >
                                <div className={`save-location-tile-icon ${provider.name}`}>
                                    {provider.name === 'googledrive' ? <FaGoogleDrive /> :
                                        provider.name === 'dropbox' ? <FaDropbox /> :
                                            <FaFolder />}
                                </div>
                                <div className="save-location-tile-title">{provider.displayName}</div>
                                <div className="save-location-tile-desc">Save to cloud storage</div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="modal-actions">
                    <button className="modal-button cancel-button" onClick={onClose}>
                        <FaTimes /> Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SaveLocationModal;
