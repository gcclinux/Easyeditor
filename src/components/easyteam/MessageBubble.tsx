import React from 'react';
import type { DecryptedMessage } from '../../services/chatService.types';

interface MessageBubbleProps {
  message: DecryptedMessage;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const className = message.isMine
    ? 'easyteam-message easyteam-message-sent'
    : 'easyteam-message easyteam-message-received';

  const formattedTime = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={className}>
      <p className="easyteam-message-text">{message.text}</p>
      <span className="easyteam-message-time">{formattedTime}</span>
    </div>
  );
};

export default MessageBubble;
