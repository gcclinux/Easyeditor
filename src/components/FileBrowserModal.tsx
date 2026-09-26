import React, { useState } from 'react';
import './fileBrowserModal.css';
import useEscapeKey from '../utils/useEscapeKey';

interface FileBrowserModalProps {
  open: boolean;
  onClose: () => void;
  onSelectFile: (filePath: string) => void;
  files: string[];
  repoPath: string;
}

const FileBrowserModal: React.FC<FileBrowserModalProps> = ({ open, onClose, onSelectFile, files, repoPath }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  useEscapeKey(onClose, open);

  if (!open) {
    return null;
  }

  const filteredFiles = files.filter(file => 
    file.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleFileClick = (file: string) => {
    setSelectedFile(file);
  };

  const handleFileDoubleClick = (file: string) => {
    onSelectFile(file);
  };

  const handleOpenSelected = () => {
    if (selectedFile) {
      onSelectFile(selectedFile);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content file-browser-modal">
        <h2>Browse Repository Files</h2>
        <p className="repo-path">Repository: {repoPath}</p>
        
        <div className="search-container">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search files..."
            className="search-input"
          />
        </div>

        <div className="file-list-container">
          {filteredFiles.length === 0 ? (
            <div className="no-files">
              {searchTerm ? 'No files match your search' : 'No markdown files found in repository'}
            </div>
          ) : (
            <ul className="file-list">
              {filteredFiles.map((file, index) => (
                <li
                  key={index}
                  className={`file-item ${selectedFile === file ? 'selected' : ''}`}
                  onClick={() => handleFileClick(file)}
                  onDoubleClick={() => handleFileDoubleClick(file)}
                >
                  <span className="file-icon">📄</span>
                  <span className="file-name">{file}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="file-count">
          {filteredFiles.length} {filteredFiles.length === 1 ? 'file' : 'files'} found
        </div>

        <div className="modal-actions">
          <button onClick={onClose} className="modal-button cancel-button">Close</button>
          <button 
            onClick={handleOpenSelected} 
            className="modal-button submit-button"
            disabled={!selectedFile}
          >
            Open File
          </button>
        </div>
      </div>
    </div>
  );
};

export default FileBrowserModal;
