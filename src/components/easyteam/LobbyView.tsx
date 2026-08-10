import React, { useState } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';

interface LobbyViewProps {
  onCreateRoom: () => void;
  onJoinRoom: (chatKey: string) => void;
  chatKey: string | null;
  isWaiting: boolean;
  error: string | null;
}

const LobbyView: React.FC<LobbyViewProps> = ({
  onCreateRoom,
  onJoinRoom,
  chatKey,
  isWaiting,
  error
}) => {
  const { t } = useLanguage();
  const [joinKey, setJoinKey] = useState('');
  const [copied, setCopied] = useState(false);

  const isValidKey = /^[A-Za-z0-9]{6}$/.test(joinKey);

  const handleCopyKey = async () => {
    if (!chatKey) return;
    try {
      await navigator.clipboard.writeText(chatKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments without clipboard API
      setCopied(false);
    }
  };

  const handleJoin = () => {
    if (isValidKey) {
      onJoinRoom(joinKey);
    }
  };

  const handleKeyInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setJoinKey(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && isValidKey) {
      handleJoin();
    }
  };

  return (
    <div className="easyteam-lobby">
      {/* Create Room Section */}
      <div className="easyteam-lobby-section">
        {!chatKey ? (
          <button
            className="easyteam-btn easyteam-btn-primary"
            onClick={onCreateRoom}
          >
            {t('easyteam.lobby.create_room')}
          </button>
        ) : (
          <div className="easyteam-lobby-key-display">
            <label className="easyteam-lobby-key-label">
              {t('easyteam.lobby.key_label')}
            </label>
            <div className="easyteam-lobby-key-row">
              <code className="easyteam-lobby-key-value">{chatKey}</code>
              <button
                className="easyteam-btn easyteam-btn-secondary"
                onClick={handleCopyKey}
              >
                {copied ? t('easyteam.lobby.copied') : t('easyteam.lobby.copy_key')}
              </button>
            </div>
            {isWaiting && (
              <p className="easyteam-lobby-waiting">
                {t('easyteam.lobby.waiting_partner')}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Join Room Section */}
      {!chatKey && (
        <div className="easyteam-lobby-section">
          <div className="easyteam-lobby-join">
            <input
              type="text"
              className="easyteam-lobby-input"
              placeholder={t('easyteam.lobby.enter_key')}
              value={joinKey}
              onChange={handleKeyInputChange}
              onKeyDown={handleKeyDown}
              maxLength={6}
            />
            <button
              className="easyteam-btn easyteam-btn-primary"
              onClick={handleJoin}
              disabled={!isValidKey}
            >
              {t('easyteam.lobby.join')}
            </button>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="easyteam-lobby-error">
          <p>{error}</p>
        </div>
      )}
    </div>
  );
};

export default LobbyView;
