/**
 * EasyTeam Chat Service
 *
 * Manages ephemeral chat room lifecycle, key generation, encryption,
 * and Firebase Realtime Database operations for the EasyTeam feature.
 */

import CryptoJS from 'crypto-js';
import { ref, get, update, set, push, remove, serverTimestamp, onDisconnect, onChildAdded, onValue, query, orderByChild } from 'firebase/database';
import { encryptTextToBytes, decryptBytesToText } from '../stpFileCrypter';
import { database } from './firebase';
import type { ChatRoom, DecryptedMessage, ParticipantRole, RoomStatus } from './chatService.types';

// ─── Internal Session State ─────────────────────────────────────────────────

let currentRoomId: string | null = null;
let currentChatKey: string | null = null;
let currentRole: ParticipantRole | null = null;

/** Active listener unsubscribe functions, cleared on disconnect */
const unsubscribeListeners: Array<() => void> = [];

// ─── Key Generation & Room ID Derivation ────────────────────────────────────

const CHAT_KEY_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const CHAT_KEY_LENGTH = 6;

/**
 * Generates a cryptographically random 6-character alphanumeric chat key.
 * Uses crypto.getRandomValues for secure randomness.
 */
export function generateChatKey(): string {
  const randomValues = new Uint8Array(CHAT_KEY_LENGTH);
  crypto.getRandomValues(randomValues);
  let key = '';
  for (let i = 0; i < CHAT_KEY_LENGTH; i++) {
    key += CHAT_KEY_CHARS[randomValues[i] % CHAT_KEY_CHARS.length];
  }
  return key;
}

/**
 * Derives a deterministic room ID from a chat key using SHA-256.
 * Returns the first 16 hex characters of the hash.
 * This ensures the actual key is never exposed in database paths.
 */
export function chatKeyToRoomId(chatKey: string): string {
  return CryptoJS.SHA256(chatKey).toString().substring(0, 16);
}

// ─── Message Encryption & Decryption ────────────────────────────────────────

/**
 * Encrypts a message text using the chat key and returns a base64-encoded string
 * suitable for Firebase storage.
 *
 * Uses the existing stpFileCrypter module (AES-256-CBC with PBKDF2) for encryption.
 * The resulting Uint8Array is converted to base64 for safe storage as a string in RTDB.
 */
export function encryptMessage(text: string, chatKey: string): string {
  const encryptedBytes = encryptTextToBytes(text, chatKey);
  return uint8ArrayToBase64(encryptedBytes);
}

/**
 * Decrypts a base64-encoded encrypted message using the chat key.
 *
 * Converts the base64 string back to a Uint8Array, then uses stpFileCrypter
 * to decrypt back to plaintext.
 */
export function decryptMessage(base64Data: string, chatKey: string): string {
  const encryptedBytes = base64ToUint8Array(base64Data);
  return decryptBytesToText(encryptedBytes, chatKey);
}

// ─── Base64 Helpers ─────────────────────────────────────────────────────────

/**
 * Converts a Uint8Array to a base64-encoded string.
 * Uses btoa with proper binary-to-string conversion for arbitrary byte data.
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts a base64-encoded string back to a Uint8Array.
 * Uses atob with proper string-to-binary conversion for arbitrary byte data.
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}


// ─── Session State Accessors ────────────────────────────────────────────────

/** Returns the current room ID, or null if not connected */
export function getCurrentRoomId(): string | null {
  return currentRoomId;
}

/** Returns the current chat key, or null if not connected */
export function getCurrentChatKey(): string | null {
  return currentChatKey;
}

/** Returns the current participant role, or null if not connected */
export function getCurrentRole(): ParticipantRole | null {
  return currentRole;
}

// ─── Firebase RTDB Room Lifecycle ───────────────────────────────────────────

/**
 * Creates a new ephemeral chat room.
 *
 * Generates a unique chat key, derives the room ID, writes the initial
 * metadata to Firebase RTDB (status: "waiting", createdAt, participantCount: 1),
 * sets up presence tracking for the creator, and configures an onDisconnect
 * handler to clean up presence if the connection drops unexpectedly.
 *
 * @returns Object containing the roomId and chatKey for sharing
 * @throws Error with a user-friendly message if room creation fails
 */
export async function createRoom(): Promise<{ roomId: string; chatKey: string }> {
  try {
    const chatKey = generateChatKey();
    const roomId = chatKeyToRoomId(chatKey);

    // Write room metadata
    const metaRef = ref(database, `/easyteam/rooms/${roomId}/meta`);
    await set(metaRef, {
      status: 'waiting',
      createdAt: serverTimestamp(),
      participantCount: 1,
    });

    // Set up presence node for the creator
    const presenceRef = ref(database, `/easyteam/rooms/${roomId}/presence/creator`);
    await set(presenceRef, true);

    // Set up onDisconnect handler to remove creator presence on unexpected disconnect
    await onDisconnect(presenceRef).remove();

    // Store session state internally
    currentRoomId = roomId;
    currentChatKey = chatKey;
    currentRole = 'creator';

    return { roomId, chatKey };
  } catch (error) {
    // Reset state on failure
    currentRoomId = null;
    currentChatKey = null;
    currentRole = null;

    if (error instanceof Error) {
      throw new Error(`Failed to create room: ${error.message}`);
    }
    throw new Error('Failed to create room: An unexpected error occurred');
  }
}

/**
 * Joins an existing chat room using the provided chat key.
 *
 * Validates the room exists and is not full (max 2 participants),
 * updates the room status to "active", sets up presence tracking
 * with onDisconnect handler, and stores the session state internally.
 *
 * @param chatKey - The 6-character alphanumeric key shared by the room creator
 * @returns The ChatRoom metadata after successfully joining
 * @throws Error with descriptive message for invalid rooms or full rooms
 */
export async function joinRoom(chatKey: string): Promise<ChatRoom> {
  try {
    const roomId = chatKeyToRoomId(chatKey);
    const metaRef = ref(database, `/easyteam/rooms/${roomId}/meta`);

    // Read room metadata to check existence and availability
    const snapshot = await get(metaRef);

    if (!snapshot.exists()) {
      throw new Error('Room not found');
    }

    const meta = snapshot.val() as {
      status: string;
      createdAt: number;
      participantCount: number;
    };

    if (meta.participantCount >= 2) {
      throw new Error('Room full');
    }

    // Update room to active with 2 participants
    await update(metaRef, {
      status: 'active',
      participantCount: 2,
    });

    // Set up presence for the joiner
    const presenceRef = ref(database, `/easyteam/rooms/${roomId}/presence/joiner`);
    await set(presenceRef, true);

    // Set up onDisconnect handler to remove presence when connection drops
    await onDisconnect(presenceRef).remove();

    // Store session state internally
    currentRoomId = roomId;
    currentChatKey = chatKey;
    currentRole = 'joiner';

    // Return ChatRoom metadata
    return {
      roomId,
      status: 'active',
      createdAt: meta.createdAt,
      participantCount: 2,
    };
  } catch (error) {
    // Re-throw descriptive errors, wrap unknown Firebase errors
    if (error instanceof Error) {
      if (error.message === 'Room not found' || error.message === 'Room full') {
        throw error;
      }
      throw new Error(`Failed to join room: ${error.message}`);
    }
    throw new Error('Failed to join room: An unexpected error occurred');
  }
}

// ─── Send Message ───────────────────────────────────────────────────────────

/**
 * Sends an encrypted message to the current chat room.
 *
 * Encrypts the text using the chat key, then pushes a new message entry
 * to the messages node in Firebase RTDB with sender role and server timestamp.
 *
 * Error-isolated: all errors are caught and logged internally.
 * Never throws or propagates errors to calling code (Requirement 11.3).
 *
 * @param text - The plaintext message to send
 */
export async function sendMessage(text: string): Promise<void> {
  try {
    // Return early if not connected to a room
    if (!currentRoomId || !currentChatKey || !currentRole) {
      return;
    }

    // Encrypt the message text using the shared chat key
    const encryptedData = encryptMessage(text, currentChatKey);

    // Push a new message to the room's messages node
    const messagesRef = ref(database, `/easyteam/rooms/${currentRoomId}/messages`);
    const newMessageRef = push(messagesRef);
    await set(newMessageRef, {
      data: encryptedData,
      sender: currentRole,
      ts: serverTimestamp(),
    });
  } catch (error) {
    // Log errors but never propagate — error-isolated per requirement 11.3
    console.error('[EasyTeam] Failed to send message:', error);
  }
}

/**
 * Registers an unsubscribe function to be called on disconnect.
 * Used by listener setup functions (onMessage, onPresenceChange, onRoomStatusChange)
 * to ensure all active listeners are cleaned up when the session ends.
 */
export function registerListener(unsubscribe: () => void): void {
  unsubscribeListeners.push(unsubscribe);
}

// ─── Disconnect & Cleanup ───────────────────────────────────────────────────

/**
 * Disconnects from the current chat room and performs cleanup.
 *
 * Steps:
 * 1. If not connected (no currentRoomId), returns immediately.
 * 2. Removes own presence node from Firebase.
 * 3. Reads the other participant's presence node.
 * 4. If other participant is NOT present → deletes the entire room node.
 * 5. If other participant IS present → updates room status to "ended".
 * 6. Clears all internal state (roomId, chatKey, role, listeners).
 *
 * Errors during disconnect are logged but not propagated (graceful cleanup).
 *
 * @returns void
 */
export async function disconnect(): Promise<void> {
  if (!currentRoomId) {
    return;
  }

  const roomId = currentRoomId;
  const role = currentRole;

  try {
    // Determine own and other presence paths
    const ownRole = role;
    const otherRole: ParticipantRole = role === 'creator' ? 'joiner' : 'creator';

    const ownPresenceRef = ref(database, `/easyteam/rooms/${roomId}/presence/${ownRole}`);
    const otherPresenceRef = ref(database, `/easyteam/rooms/${roomId}/presence/${otherRole}`);

    // Remove own presence node
    await remove(ownPresenceRef);

    // Check if the other participant is still present
    const otherSnapshot = await get(otherPresenceRef);

    if (!otherSnapshot.exists() || otherSnapshot.val() === null) {
      // Both participants are gone — delete the entire room
      const roomRef = ref(database, `/easyteam/rooms/${roomId}`);
      await remove(roomRef);
    } else {
      // Other participant is still present — mark session as ended
      const statusRef = ref(database, `/easyteam/rooms/${roomId}/meta/status`);
      await set(statusRef, 'ended');
    }
  } catch (error) {
    // Graceful cleanup: log error but do not propagate
    console.error('[EasyTeam] Error during disconnect:', error);
  } finally {
    // Clear all internal state regardless of success/failure
    currentRoomId = null;
    currentChatKey = null;
    currentRole = null;

    // Unsubscribe all active listeners
    for (const unsub of unsubscribeListeners) {
      try {
        unsub();
      } catch {
        // Ignore errors from unsubscribe calls
      }
    }
    unsubscribeListeners.length = 0;
  }
}

// ─── Real-Time Listeners ────────────────────────────────────────────────────

/**
 * Listens for new messages in the current chat room.
 *
 * Subscribes to `onChildAdded` on the messages node, ordered by timestamp.
 * For each new message, decodes the base64 data, decrypts it using the chat key,
 * and invokes the callback with a DecryptedMessage object.
 *
 * Sets `isMine` based on whether the message sender matches the current role.
 * If decryption fails for a message, displays "[decryption error]" as the text.
 *
 * The unsubscribe function is stored so disconnect() can clean up.
 *
 * @param callback - Called with each new decrypted message
 * @returns Unsubscribe function to stop listening
 */
export function onMessage(callback: (msg: DecryptedMessage) => void): () => void {
  if (!currentRoomId || !currentChatKey || !currentRole) {
    // Return a no-op unsubscribe if not connected
    return () => {};
  }

  const roomId = currentRoomId;
  const chatKey = currentChatKey;
  const role = currentRole;

  const messagesRef = ref(database, `/easyteam/rooms/${roomId}/messages`);
  const messagesQuery = query(messagesRef, orderByChild('ts'));

  const unsubscribe = onChildAdded(messagesQuery, (snapshot) => {
    try {
      const data = snapshot.val();
      if (!data) return;

      let text: string;
      try {
        text = decryptMessage(data.data, chatKey);
      } catch {
        text = '[decryption error]';
      }

      const message: DecryptedMessage = {
        id: snapshot.key || '',
        text,
        sender: data.sender,
        timestamp: data.ts || 0,
        isMine: data.sender === role,
      };

      callback(message);
    } catch (error) {
      console.error('[EasyTeam] Error processing message:', error);
    }
  });

  // Store unsubscribe for cleanup during disconnect
  unsubscribeListeners.push(unsubscribe);

  return unsubscribe;
}

/**
 * Listens for presence changes of the other participant.
 *
 * Subscribes to the other participant's presence node via `onValue`.
 * Calls callback(true) when the other participant is present,
 * callback(false) when they are not.
 *
 * The unsubscribe function is stored so disconnect() can clean up.
 *
 * @param callback - Called with the online status of the other participant
 * @returns Unsubscribe function to stop listening
 */
export function onPresenceChange(callback: (online: boolean) => void): () => void {
  if (!currentRoomId || !currentRole) {
    return () => {};
  }

  const roomId = currentRoomId;
  const otherRole: ParticipantRole = currentRole === 'creator' ? 'joiner' : 'creator';

  const presenceRef = ref(database, `/easyteam/rooms/${roomId}/presence/${otherRole}`);

  const unsubscribe = onValue(presenceRef, (snapshot) => {
    const isOnline = snapshot.exists() && snapshot.val() === true;
    callback(isOnline);
  });

  // Store unsubscribe for cleanup during disconnect
  unsubscribeListeners.push(unsubscribe);

  return unsubscribe;
}

/**
 * Listens for room status changes (waiting, active, ended).
 *
 * Subscribes to the room's meta/status node via `onValue`.
 * Calls the callback with the new status value whenever it changes.
 *
 * The unsubscribe function is stored so disconnect() can clean up.
 *
 * @param callback - Called with the new room status
 * @returns Unsubscribe function to stop listening
 */
export function onRoomStatusChange(callback: (status: RoomStatus) => void): () => void {
  if (!currentRoomId) {
    return () => {};
  }

  const roomId = currentRoomId;

  const statusRef = ref(database, `/easyteam/rooms/${roomId}/meta/status`);

  const unsubscribe = onValue(statusRef, (snapshot) => {
    if (snapshot.exists()) {
      const status = snapshot.val() as RoomStatus;
      callback(status);
    }
  });

  // Store unsubscribe for cleanup during disconnect
  unsubscribeListeners.push(unsubscribe);

  return unsubscribe;
}

// ─── Connection Status ──────────────────────────────────────────────────────

/**
 * Returns whether there is an active room connection.
 * True if currently connected to a chat room, false otherwise.
 */
export function isConnected(): boolean {
  return currentRoomId !== null;
}
