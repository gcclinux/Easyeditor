import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import MessageBubble from './MessageBubble';
import type { DecryptedMessage } from '../../services/chatService.types';

interface ChatViewProps {
  messages: DecryptedMessage[];
  onSendMessage: (text: string) => void;
  partnerOnline: boolean;
  roomStatus: 'waiting' | 'active' | 'ended';
  onEndChat: () => void;
}

const ChatView: React.FC<ChatViewProps> = ({
  messages,
  onSendMessage,
  partnerOnline,
  roomStatus,
  onEndChat,
}) => {
  const { t } = useLanguage();
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [prevPartnerOnline, setPrevPartnerOnline] = useState<boolean | null>(null);

  // Auto-scroll to newest message when messages array changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Track partner online state transitions for notifications
  useEffect(() => {
    if (prevPartnerOnline !== null && prevPartnerOnline !== partnerOnline) {
      // State changed — notification will be shown in render
    }
    setPrevPartnerOnline(partnerOnline);
  }, [partnerOnline]);

  const handleSend = () => {
    const trimmed = inputText.trim();
    if (trimmed) {
      onSendMessage(trimmed);
      setInputText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <div className="easyteam-chat">
      {/* Status notifications */}
      <div className="easyteam-chat-status">
        {roomStatus === 'ended' && (
          <p className="easyteam-chat-notification easyteam-chat-notification-ended">
            {t('easyteam.chat.session_ended')}
          </p>
        )}
        {roomStatus === 'active' && partnerOnline && prevPartnerOnline === false && (
          <p className="easyteam-chat-notification easyteam-chat-notification-joined">
            {t('easyteam.chat.partner_joined')}
          </p>
        )}
        {roomStatus === 'active' && !partnerOnline && prevPartnerOnline === true && (
          <p className="easyteam-chat-notification easyteam-chat-notification-left">
            {t('easyteam.chat.partner_left')}
          </p>
        )}
      </div>

      {/* Reconnecting indicator placeholder */}
      {/* TODO: Wire up .info/connected listener for reconnecting state */}

      {/* Message list */}
      <div className="easyteam-chat-messages">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="easyteam-chat-input">
        <input
          type="text"
          className="easyteam-chat-input-field"
          placeholder={t('easyteam.chat.type_message')}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={roomStatus === 'ended'}
        />
        <button
          className="easyteam-btn easyteam-btn-primary easyteam-chat-send-btn"
          onClick={handleSend}
          disabled={roomStatus === 'ended' || !inputText.trim()}
        >
          {t('easyteam.chat.send')}
        </button>
      </div>

      {/* End Chat button */}
      <div className="easyteam-chat-actions">
        <button
          className="easyteam-btn easyteam-btn-danger easyteam-chat-end-btn"
          onClick={onEndChat}
        >
          {t('easyteam.chat.end_chat')}
        </button>
      </div>
    </div>
  );
};

export default ChatView;
