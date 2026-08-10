import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { DecryptedMessage } from '../../services/chatService.types';

interface MessageBubbleProps {
  message: DecryptedMessage;
  onInsert?: (text: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onInsert }) => {
  const className = message.isMine
    ? 'easyteam-message easyteam-message-sent'
    : 'easyteam-message easyteam-message-received';

  const formattedTime = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={className}>
      <div className="easyteam-message-text">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {message.text}
        </ReactMarkdown>
      </div>
      <div className="easyteam-message-footer">
        <span className="easyteam-message-time">{formattedTime}</span>
        {onInsert && (
          <button
            className="easyteam-message-insert-btn"
            onClick={() => onInsert(message.text)}
            title="Insert into editor"
          >
            Insert
          </button>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
