/**
 * EasyTeam Chat Service Types
 *
 * Type definitions for the ephemeral chat feature.
 * All interfaces define the contract for real-time encrypted messaging
 * between two participants sharing a Chat_ID_Key.
 */

/** Room lifecycle status */
export type RoomStatus = 'waiting' | 'active' | 'ended';

/** Participant role within a chat room */
export type ParticipantRole = 'creator' | 'joiner';

/** Represents a chat room's metadata */
export interface ChatRoom {
  roomId: string;
  status: RoomStatus;
  createdAt: number;
  participantCount: number;
}

/** A message as stored in Firebase (encrypted) */
export interface ChatMessage {
  id: string;
  encryptedData: string;   // Base64-encoded encrypted payload
  sender: string;          // Participant identifier ("creator" | "joiner")
  timestamp: number;       // Server timestamp
}

/** A message after decryption, ready for display */
export interface DecryptedMessage {
  id: string;
  text: string;
  sender: string;
  timestamp: number;
  isMine: boolean;
}

/** Public API for the Chat Service */
export interface IChatService {
  createRoom(): Promise<{ roomId: string; chatKey: string }>;
  joinRoom(chatKey: string): Promise<ChatRoom>;
  sendMessage(text: string): Promise<void>;
  onMessage(callback: (msg: DecryptedMessage) => void): () => void;
  onPresenceChange(callback: (online: boolean) => void): () => void;
  onRoomStatusChange(callback: (status: RoomStatus) => void): () => void;
  disconnect(): Promise<void>;
  isConnected(): boolean;
}
