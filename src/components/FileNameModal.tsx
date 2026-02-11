import React, { useState, useEffect, useRef } from 'react';
import { FaEdit, FaCheck, FaTimes } from 'react-icons/fa';
import './FileNameModal.css';

interface FileNameModalProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (fileName: string) => void;
    title?: string;
    initialValue?: string;
    placeholder?: string;
    submitLabel?: string;
}

const FileNameModal: React.FC<FileNameModalProps> = ({
    open,
    onClose,
    onSubmit,
    title = "Enter File Name",
    initialValue = "",
    placeholder = "Enter file name...",
    submitLabel = "Save"
}) => {
    const [fileName, setFileName] = useState(initialValue);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            setFileName(initialValue);
            // Focus input after a short delay to allow modal animation
            setTimeout(() => {
                if (inputRef.current) {
                    inputRef.current.focus();
                    inputRef.current.select();
                }
            }, 100);
        }
    }, [open, initialValue]);

    const handleSubmit = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (fileName.trim()) {
            onSubmit(fileName.trim());
            setFileName(""); // Clear on submit
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSubmit();
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    if (!open) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content file-name-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>
                        <FaEdit />
                        {title}
                    </h2>
                </div>

                <div className="modal-body">
                    <form onSubmit={handleSubmit}>
                        <div className="input-group">
                            <input
                                ref={inputRef}
                                type="text"
                                value={fileName}
                                onChange={(e) => setFileName(e.target.value)}
                                placeholder={placeholder}
                                onKeyDown={handleKeyDown}
                                className="file-name-input"
                                autoFocus
                            />
                        </div>
                    </form>
                </div>

                <div className="modal-footer">
                    <button className="modal-button secondary" onClick={onClose}>
                        <FaTimes /> Cancel
                    </button>
                    <button
                        className="modal-button primary"
                        onClick={() => handleSubmit()}
                        disabled={!fileName.trim()}
                    >
                        <FaCheck /> {submitLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FileNameModal;
