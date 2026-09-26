import React, { useState } from 'react';
import './gitHistoryModal.css';
import { FaCodeBranch, FaUser, FaClock } from 'react-icons/fa';

interface Commit {
  oid: string;
  message?: string;
  author?: {
    name: string;
    email: string;
    timestamp: number;
  };
  // isomorphic-git structure
  commit?: {
    message: string;
    author: {
      name: string;
      email: string;
      timestamp: number;
    };
  };
}

interface GitHistoryModalProps {
  open: boolean;
  onClose: () => void;
  commits: Commit[];
  repoPath?: string;
}

const GitHistoryModal: React.FC<GitHistoryModalProps> = ({ 
  open, 
  onClose, 
  commits,
  repoPath = ''
}) => {
  const [selectedCommit, setSelectedCommit] = useState<Commit | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const formatDate = (timestamp: number | undefined): string => {
    if (!timestamp) return 'Unknown date';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  const formatRelativeTime = (timestamp: number | undefined): string => {
    if (!timestamp) return 'Unknown time';
    const now = Date.now();
    const commitTime = timestamp * 1000;
    const diff = now - commitTime;
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  };

  const getShortHash = (oid: string): string => {
    return oid.substring(0, 7);
  };

  const handleCommitClick = (commit: Commit) => {
    setSelectedCommit(selectedCommit?.oid === commit.oid ? null : commit);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content git-history-modal">
        <h2>Commit History</h2>
        {repoPath && <p className="repo-path">Repository: {repoPath}</p>}

        <div className="history-container">
          {commits.length === 0 ? (
            <div className="no-commits">
              <p>No commits found in this repository</p>
            </div>
          ) : (
            <ul className="commits-list">
              {commits.map((commit) => {
                // Defensive check for malformed commit data
                if (!commit || !commit.oid) return null;
                
                // Normalize data structure - handle both isomorphic-git and custom format
                const author = commit.author || commit.commit?.author || { name: 'Unknown', email: '', timestamp: 0 };
                const message = commit.message || commit.commit?.message || 'No message';
                
                return (
                  <li 
                    key={commit.oid}
                    className={`commit-item ${selectedCommit?.oid === commit.oid ? 'selected' : ''}`}
                    onClick={() => handleCommitClick(commit)}
                  >
                    <div className="commit-header">
                      <div className="commit-hash">
                        <FaCodeBranch className="commit-icon" />
                        <code>{getShortHash(commit.oid)}</code>
                      </div>
                      <div className="commit-time">
                        <FaClock className="time-icon" />
                        <span>{formatRelativeTime(author.timestamp)}</span>
                      </div>
                    </div>
                    
                    <div className="commit-message">
                      {message.split('\n')[0]}
                    </div>
                    
                    <div className="commit-author">
                      <FaUser className="author-icon" />
                      <span>{author.name}</span>
                      {author.email && <span className="author-email">({author.email})</span>}
                    </div>

                    {selectedCommit?.oid === commit.oid && (
                      <div className="commit-details">
                        <div className="detail-row">
                          <strong>Full Hash:</strong>
                          <code className="full-hash">{commit.oid}</code>
                        </div>
                        <div className="detail-row">
                          <strong>Date:</strong>
                          <span>{formatDate(author.timestamp)}</span>
                        </div>
                        {message.includes('\n') && (
                          <div className="detail-row">
                            <strong>Full Message:</strong>
                            <pre className="full-message">{message}</pre>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="history-footer">
          <span className="commit-count">
            {commits.length} commit{commits.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="modal-actions">
          <button onClick={onClose} className="modal-button close-button">Close</button>
        </div>
      </div>
    </div>
  );
};

export default GitHistoryModal;
