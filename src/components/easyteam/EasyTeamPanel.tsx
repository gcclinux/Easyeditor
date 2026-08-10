import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FaUsers, FaTimes } from 'react-icons/fa';
import { useLanguage } from '../../i18n/LanguageContext';
import LobbyView from './LobbyView';
import ChatView from './ChatView';
import {
  createRoom,
  joinRoom,
  sendMessage,
  disconnect,
  onMessage,
  onPresenceChange,
  onRoomStatusChange,
} from '../../services/chatService';
import type { DecryptedMessage, RoomStatus } from '../../services/chatService.types';
import './EasyTeamPanel.css';

// ─── Props Interface ────────────────────────────────────────────────────────

interface EasyTeamPanelProps {
  showEasyTeamPanel: boolean;
  setShowEasyTeamPanel: (show: boolean) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  onInsertToEditor?: (text: string) => void;
}

// ─── Error Boundary ─────────────────────────────────────────────────────────

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class EasyTeamErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[EasyTeam] Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="easyteam-error-fallback">
            <p>Something went wrong in EasyTeam.</p>
            <button
              className="easyteam-btn easyteam-btn-secondary"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try Again
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

// ─── EasyTeamPanel Component ────────────────────────────────────────────────

const EasyTeamPanel: React.FC<EasyTeamPanelProps> = ({
  showEasyTeamPanel,
  setShowEasyTeamPanel,
  showToast,
  onInsertToEditor,
}) => {
  const { t } = useLanguage();
  const panelRef = useRef<HTMLDivElement>(null);

  // Chat state
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [roomStatus, setRoomStatus] = useState<RoomStatus>('waiting');
  const [chatKey, setChatKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  // Panel width: 40% of viewport width (just 10% shorter than half screen)

  // ─── Set Up Listeners ───────────────────────────────────────────────────

  const setupListeners = useCallback(() => {
    const unsubMessage = onMessage((msg: DecryptedMessage) => {
      setMessages((prev) => [...prev, msg]);
    });

    const unsubPresence = onPresenceChange((online: boolean) => {
      setPartnerOnline(online);
    });

    const unsubStatus = onRoomStatusChange((status: RoomStatus) => {
      setRoomStatus(status);
    });

    return () => {
      unsubMessage();
      unsubPresence();
      unsubStatus();
    };
  }, []);

  // ─── Create Room Handler ────────────────────────────────────────────────

  const handleCreateRoom = useCallback(async () => {
    try {
      setError(null);
      const result = await createRoom();
      setChatKey(result.chatKey);
      setRoomStatus('waiting');
      setConnected(true);
      setupListeners();
    } catch (err) {
      const message = err instanceof Error ? err.message : t('easyteam.errors.connection_failed');
      setError(message);
      showToast(message, 'error');
    }
  }, [setupListeners, showToast, t]);

  // ─── Join Room Handler ──────────────────────────────────────────────────

  const handleJoinRoom = useCallback(async (key: string) => {
    try {
      setError(null);
      const room = await joinRoom(key);
      setChatKey(key);
      setRoomStatus(room.status);
      setConnected(true);
      setupListeners();
    } catch (err) {
      let message: string;
      if (err instanceof Error) {
        if (err.message === 'Room not found') {
          message = t('easyteam.errors.room_not_found');
        } else if (err.message === 'Room full') {
          message = t('easyteam.errors.room_full');
        } else {
          message = err.message;
        }
      } else {
        message = t('easyteam.errors.connection_failed');
      }
      setError(message);
      showToast(message, 'error');
    }
  }, [setupListeners, showToast, t]);

  // ─── Send Message Handler ───────────────────────────────────────────────

  const handleSendMessage = useCallback(async (text: string) => {
    await sendMessage(text);
  }, []);

  // ─── End Chat / Disconnect Handler ──────────────────────────────────────

  const handleEndChat = useCallback(async () => {
    try {
      await disconnect();
    } catch (err) {
      console.error('[EasyTeam] Error during end chat:', err);
    } finally {
      // Reset all local state
      setMessages([]);
      setPartnerOnline(false);
      setRoomStatus('waiting');
      setChatKey(null);
      setError(null);
      setConnected(false);
    }
  }, []);

  // ─── Close Panel Handler ────────────────────────────────────────────────

  const handleClose = useCallback(() => {
    setShowEasyTeamPanel(false);
  }, [setShowEasyTeamPanel]);

  // ─── Close on click outside ─────────────────────────────────────────────

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showEasyTeamPanel &&
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        setShowEasyTeamPanel(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEasyTeamPanel, setShowEasyTeamPanel]);

  // ─── Status Badge Rendering ─────────────────────────────────────────────

  const renderStatusBadge = () => {
    if (!connected || !chatKey) return null;

    const statusText = t(`easyteam.status.${roomStatus}`);
    const statusColor = roomStatus === 'active' ? '#48bb78' : roomStatus === 'waiting' ? '#f6ad55' : '#e53e3e';

    return (
      <span className="easyteam-header-status">
        <code className="easyteam-header-key">{chatKey}</code>
        <span
          className="easyteam-header-badge"
          style={{ backgroundColor: statusColor }}
        >
          {statusText}
        </span>
      </span>
    );
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div
      ref={panelRef}
      className={`easyteam-panel ${showEasyTeamPanel ? 'easyteam-panel-open' : ''}`}
      style={{
        position: 'fixed',
        top: '120px',
        right: showEasyTeamPanel ? '0' : '-45vw',
        width: '40vw',
        height: 'calc(100vh - 120px)',
        backgroundColor: 'var(--bg-dropdown)',
        color: 'var(--color-text-dropdown)',
        zIndex: 1000000,
        transition: 'right 0.3s ease-in-out',
        borderLeft: '2px solid var(--border-secondary)',
        boxShadow: showEasyTeamPanel ? '-2px 0 10px var(--shadow-md)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div className="easyteam-panel-content">
        {/* Header */}
        <div className="easyteam-panel-header">
          <div className="easyteam-panel-header-left">
            <h2 className="easyteam-panel-title">
              <FaUsers style={{ marginRight: '10px' }} />
              {t('easyteam.title')}
            </h2>
            {renderStatusBadge()}
          </div>
          <button
            className="easyteam-panel-close-btn"
            onClick={handleClose}
            title={`Close ${t('easyteam.title')}`}
          >
            <FaTimes />
          </button>
        </div>

        {/* Content — wrapped in Error Boundary */}
        <EasyTeamErrorBoundary>
          <div className="easyteam-panel-body">
            {connected ? (
              <ChatView
                messages={messages}
                onSendMessage={handleSendMessage}
                partnerOnline={partnerOnline}
                roomStatus={roomStatus}
                onEndChat={handleEndChat}
                onInsertToEditor={onInsertToEditor}
              />
            ) : (
              <LobbyView
                onCreateRoom={handleCreateRoom}
                onJoinRoom={handleJoinRoom}
                chatKey={chatKey}
                isWaiting={roomStatus === 'waiting' && chatKey !== null}
                error={error}
              />
            )}
          </div>
        </EasyTeamErrorBoundary>
      </div>
    </div>
  );
};

export default EasyTeamPanel;
