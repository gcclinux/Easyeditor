import { FaCodeBranch, FaClone, FaDownload, FaUpload, FaSync, FaSave, FaKey, FaLock, FaHistory, FaPlus, FaFolderOpen, FaTimes } from 'react-icons/fa';
import { useLanguage } from '../i18n/LanguageContext';
import './gitModal.css';

type Props = {
  onClone: () => void;
  onOpenRepository: () => void;
  onPull: () => void;
  onPush: () => void;
  onFetch: () => void;
  onCommit: () => void;
  onSave: () => void;
  onSetupCredentials: () => void;
  onClearCredentials: () => void;
  onViewHistory: () => void;
  onInitRepo: () => void;
  onClose: () => void;
  hasCredentials: boolean;
  isAuthenticated: boolean;
  onSaveCommitPush: () => void;
};

export default function GitModal({
  onClone,
  onOpenRepository,
  onPull,
  onPush,
  onFetch,
  onCommit,
  onSave,
  onSetupCredentials,
  onClearCredentials,
  onViewHistory,
  onInitRepo,
  onClose,
  hasCredentials,
  isAuthenticated,
  onSaveCommitPush
}: Props) {
  const { t } = useLanguage();

  const handleTileClick = (action: () => void, requiresAuth: boolean) => {
    if (requiresAuth && !isAuthenticated) {
      onSetupCredentials();
    } else {
      action();
    }
    onClose();
  };

  const renderTile = (
    icon: React.ReactNode,
    titleKey: string,
    descKey: string,
    onClick: () => void,
    requiresAuth: boolean = false
  ) => {
    const needsAuth = requiresAuth && !isAuthenticated;

    return (
      <button
        className={`git-tile ${needsAuth ? 'requires-auth' : ''}`}
        onClick={() => handleTileClick(onClick, requiresAuth)}
        title={needsAuth ? t('git.auth_required') : ''}
      >
        <div className="git-tile-icon">
          {icon}
          {needsAuth && <FaLock className="git-tile-lock" />}
        </div>
        <div className="git-tile-title">{t(titleKey)}</div>
        <div className="git-tile-desc">{needsAuth ? t('git.requires_auth') : t(descKey)}</div>
      </button>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content git-modal" onClick={(e) => e.stopPropagation()}>
        <h2>
          <FaCodeBranch /> {t('menu.git')}
        </h2>
        <p className="git-modal-subtitle">Version control operations</p>

        {/* Repository Operations */}
        <div className="git-tiles-section">
          <div className="git-tiles-section-title">Repository</div>
          <div className="git-tiles-grid">
            {renderTile(<FaClone />, 'git.clone', 'git.clone_desc', onClone, false)}
            {renderTile(<FaFolderOpen />, 'git.open', 'git.open_desc', onOpenRepository, false)}
            {renderTile(<FaPlus />, 'git.init', 'git.init_desc', onInitRepo, false)}
            {renderTile(<FaHistory />, 'git.history', 'git.history_desc', onViewHistory, false)}
          </div>
        </div>

        {/* Sync & Changes Operations */}
        <div className="git-tiles-section">
          <div className="git-tiles-section-title">Sync & Changes</div>
          <div className="git-tiles-grid">
            {renderTile(<FaDownload />, 'git.pull', 'git.pull_desc', onPull, true)}
            {renderTile(<FaUpload />, 'git.push', 'git.push_desc', onPush, true)}
            {renderTile(<FaSync />, 'git.fetch', 'git.fetch_desc', onFetch, true)}
            {renderTile(<FaCodeBranch />, 'git.commit', 'git.commit_desc', onCommit, true)}
            {renderTile(<FaSave />, 'git.save_stage', 'git.save_stage_desc', onSave, true)}
            {renderTile(<FaSave />, 'git.one_click', 'git.one_click_desc', onSaveCommitPush, true)}
          </div>
        </div>

        {/* Credentials */}
        <div className="git-credentials-section">
          <button
            className="git-tile"
            onClick={() => { onSetupCredentials(); onClose(); }}
          >
            <div className="git-tile-icon"><FaKey /></div>
            <div className="git-tile-title">{hasCredentials ? t('git.authenticate') : t('git.setup')}</div>
            <div className="git-tile-desc">{hasCredentials ? t('git.view_creds') : t('git.save_creds')}</div>
          </button>
          {hasCredentials && (
            <button
              className="git-tile"
              onClick={() => { onClearCredentials(); onClose(); }}
            >
              <div className="git-tile-icon"><FaLock /></div>
              <div className="git-tile-title">{t('git.clear')}</div>
              <div className="git-tile-desc">{t('git.clear_desc')}</div>
            </button>
          )}
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
