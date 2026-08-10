# EasyTeam — Ephemeral Team collaboration

EasyTeam is a privacy-first, ephemeral team collaboration feature built into EasyEditor. It allows two users to communicate in real time through a shared 6-character key. Messages are encrypted client-side using AES-256-CBC before touching the server, and all data is permanently destroyed when the session ends.

---

## Overview

EasyTeam provides a secure, temporary collaboration channel between two EasyEditor users. The design principles are:

- **End-to-end encrypted** — Messages are encrypted on the sender's device and decrypted on the receiver's device. Firebase only ever stores ciphertext.
- **Ephemeral** — No message history is retained. When both participants disconnect, the team session and all its data are permanently deleted.
- **No accounts required** — Access is controlled by a shared 6-character key. No Firebase Authentication or sign-in is needed.
- **Minimal footprint** — The feature is additive; it does not modify any existing EasyEditor module or configuration.

---

## How to Use

### Creating a Team

1. Click the **EasyTeam** button (users icon) in the navigation bar.
2. The EasyTeam panel slides in from the right side.
3. Click **"Create Team"**.
4. A unique 6-character alphanumeric key is generated and displayed.
5. Share this key with your team partner (verbally, via email, etc.).
6. The panel shows "Waiting for partner to join..." until the other user connects.

### Joining a Team

1. Click the **EasyTeam** button in the navigation bar.
2. Enter the 6-character key that was shared with you.
3. Click **"Join"**.
4. If the key is valid and the team has space, the session becomes active immediately.

### During a Session

- Type your message in the input field and click **Send** (or press Enter).
- Messages are encrypted before sending and decrypted on receipt — all in real time.
- The panel header shows the current team key and status (Active / Connected).
- You can see when your partner is connected or disconnected via status indicators.
- Messages you send appear on the right; messages you receive appear on the left.
- The message list auto-scrolls to the newest message.

### Ending a Session

- Click **"End Chat"** to disconnect from the team.
- When either participant disconnects, the other receives a notification that their partner has left.
- When both participants have disconnected, all session data (messages, metadata, presence) is permanently deleted from Firebase.
- If a team is created but no one joins within 10 minutes, it is automatically cleaned up.

---

## Technical Details

### Encryption

EasyTeam uses the existing `stpFileCrypter` module for all encryption operations:

| Parameter | Value |
|:---|:---|
| Algorithm | AES-256-CBC |
| Key Derivation | PBKDF2 |
| PBKDF2 Iterations | 10,000 |
| Salt | 128-bit (random, per-encryption) |
| IV | 128-bit (random, per-encryption) |
| Encryption Password | The 6-character Chat ID Key |

The encryption functions used are:
- `encryptTextToBytes(plaintext, chatKey)` — returns a `Uint8Array` containing salt + IV + ciphertext
- `decryptBytesToText(data, chatKey)` — returns the original plaintext string

### Team ID Derivation

Team IDs stored in Firebase are SHA-256 hashes of the chat key (first 16 hex characters). This prevents the key from being exposed through database paths:

```
chatKey "Ab3xY9" → SHA-256 → "a1b2c3d4e5f6g7h8..." → roomId "a1b2c3d4e5f6g7h8"
```

Without knowing the original key, discovering a valid team path is computationally infeasible.

### Data Flow

**Sending a message:**

```
plaintext → encryptTextToBytes(text, chatKey) → Uint8Array → base64 encode → Firebase RTDB
```

**Receiving a message:**

```
Firebase RTDB → base64 decode → Uint8Array → decryptBytesToText(data, chatKey) → plaintext
```

### Firebase Realtime Database Structure

```
easyteam/
└── rooms/
    └── {roomId}/
        ├── meta/
        │   ├── status: "waiting" | "active" | "ended"
        │   ├── createdAt: <server_timestamp>
        │   └── participantCount: 1 | 2
        ├── presence/
        │   ├── creator: true | null
        │   └── joiner: true | null
        └── messages/
            └── {pushId}/
                ├── data: "<base64_encrypted_string>"
                ├── sender: "creator" | "joiner"
                └── ts: <server_timestamp>
```

### Ephemeral Behaviour

EasyTeam uses a multi-layer cleanup strategy to ensure no data persists:

1. **`onDisconnect` handlers** — Each participant registers a Firebase `onDisconnect().remove()` handler on their presence node. If the client drops unexpectedly (network loss, browser close), Firebase's server automatically removes the presence entry.

2. **Client-side cleanup** — When a participant explicitly leaves:
   - Their presence node is removed.
   - If both participants are gone, the entire team node is deleted.
   - If the other participant is still present, the team status is set to "ended".

3. **Scheduled Cloud Function** (`cleanupExpiredRooms`) — Runs every 5 minutes as a safety net:
   - Deletes teams in "waiting" status older than 10 minutes (abandoned teams).
   - Deletes teams in "ended" status older than 1 minute (failed client cleanup).

### Connection State Management

- A presence indicator is maintained for each participant using Firebase's `onDisconnect` API.
- When a partner disconnects, the panel displays a notification ("Partner has left the session").
- If a network disconnection occurs, the panel shows a "Reconnecting..." status indicator. Firebase's SDK handles automatic reconnection.
- Unexpected disconnections trigger the `onDisconnect` handler within approximately 30 seconds.

### Security Model

| Aspect | Approach |
|:---|:---|
| Message confidentiality | AES-256-CBC encryption; only participants with the key can decrypt |
| Team access control | Room IDs are SHA-256 hashes; guessing a valid path requires knowing the key |
| Authentication | None required — the shared key IS the access credential |
| Data at rest | Only encrypted ciphertext stored in Firebase; plaintext never persists |
| Data deletion | Multi-layer cleanup ensures complete destruction |

### Error Handling

All errors within EasyTeam are isolated and do not affect other EasyEditor features:

- Invalid key format → client-side validation before any Firebase call
- Team not found → localized error message in the panel
- Team full (2 participants max) → localized error message
- Encryption/decryption failure → caught internally; error toast shown
- Network disconnection → automatic reconnection via Firebase SDK
- Unexpected errors → React Error Boundary prevents crashes from propagating

---

## Supported Locales

EasyTeam is fully localized in all 6 languages supported by EasyEditor:

| Locale Code | Language |
|:---|:---|
| `en` | English |
| `de` | German (Deutsch) |
| `es` | Spanish (Español) |
| `nl` | Dutch (Nederlands) |
| `pl` | Polish (Polski) |
| `pt-br` | Brazilian Portuguese (Português do Brasil) |

All UI text — labels, buttons, status messages, and error notifications — is translated via the `easyteam.*` namespace in each locale file under `src/i18n/locales/`. When the application language is changed, the EasyTeam panel updates all displayed text immediately without requiring a reload.

---

## Theming

EasyTeam is fully integrated with EasyEditor's theme system:

- All colours, fonts, spacing, and border styles use the application's existing CSS variables (e.g., `--bg-dropdown`, `--color-text-dropdown`, `--border-color`).
- When the user switches between dark and light mode, the EasyTeam panel updates automatically — no page refresh required.
- The panel follows the same layout patterns, component sizing, and visual hierarchy used by the EasyAI panel.
- Message bubbles use theme-aware colours for sent (right-aligned) and received (left-aligned) messages.

---

## Feature Flag

EasyTeam is controlled by the `EASY_TEAM` feature flag in `src/config/features.ts`:

```typescript
export const FEATURES = {
  EASY_NOTES: true,
  EASY_TEAM: true,   // Set to false to disable EasyTeam entirely
} as const;
```

When the flag is set to `false`:
- The EasyTeam button is hidden from the navigation bar.
- The panel component is not rendered.
- No Firebase listeners or connections are established.

---

## File Structure

```
src/
├── components/
│   └── easyteam/
│       ├── EasyTeamPanel.tsx      # Main sliding panel component
│       ├── EasyTeamPanel.css      # Panel styles (CSS variables)
│       ├── ChatView.tsx           # Message list + input area
│       ├── LobbyView.tsx          # Create/Join team UI
│       └── MessageBubble.tsx      # Individual message display
├── services/
│   ├── chatService.ts            # Firebase RTDB operations + encryption
│   └── chatService.types.ts      # TypeScript interfaces and types
├── config/
│   └── features.ts               # EASY_TEAM flag
└── i18n/
    └── locales/
        ├── en.json               # easyteam.* keys (English)
        ├── de.json               # easyteam.* keys (German)
        ├── es.json               # easyteam.* keys (Spanish)
        ├── nl.json               # easyteam.* keys (Dutch)
        ├── pl.json               # easyteam.* keys (Polish)
        └── pt-br.json            # easyteam.* keys (Brazilian Portuguese)
```
