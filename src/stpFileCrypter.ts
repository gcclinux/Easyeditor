import CryptoJS from 'crypto-js';

type WordArray = CryptoJS.lib.WordArray;

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

// Magic Header for new files: "SSTP02"
// Hex: 53 53 54 50 30 32
const HEADER_STRING = "SSTP02";
const HEADER_LENGTH = 6;
const SALT_SIZE = 16; // 128 bits
const IV_SIZE = 16;   // 128 bits
const KEY_ITERATIONS = 10000;
const KEY_SIZE = 256 / 32; // 256 bits

// --- Helper Functions ---

const uint8ArrayToWordArray = (u8Array: Uint8Array): WordArray => {
  const words: number[] = [];
  for (let i = 0; i < u8Array.length; i += 4) {
    words.push(
      (u8Array[i] << 24) |
        ((u8Array[i + 1] ?? 0) << 16) |
        ((u8Array[i + 2] ?? 0) << 8) |
        (u8Array[i + 3] ?? 0)
    );
  }
  return CryptoJS.lib.WordArray.create(words, u8Array.length);
};

const wordArrayToUint8Array = (wordArray: WordArray): Uint8Array => {
  const { words, sigBytes } = wordArray;
  const u8Array = new Uint8Array(sigBytes);
  let offset = 0;

  for (let i = 0; i < sigBytes; i++) {
    const word = words[i >>> 2];
    const byte = (word >>> (24 - (i % 4) * 8)) & 0xff;
    u8Array[offset++] = byte;
  }

  return u8Array;
};

// Check if data starts with "SSTP02"
const isNewFormat = (data: Uint8Array): boolean => {
  if (data.length < HEADER_LENGTH) return false;
  const headerBytes = textEncoder.encode(HEADER_STRING);
  for (let i = 0; i < HEADER_LENGTH; i++) {
    if (data[i] !== headerBytes[i]) return false;
  }
  return true;
};

// --- Legacy Implementation (DES-ECB) ---

const normalizeKeyLegacy = (key: string): WordArray => {
  if (!key) throw new Error('Encryption key is required.');
  const keyBytes = textEncoder.encode(key);
  if (keyBytes.length < 8) throw new Error('Encryption key must be at least 8 bytes long.');
  const normalized = keyBytes.slice(0, 8);
  return uint8ArrayToWordArray(normalized);
};

const createCipherParams = (ciphertext: WordArray): CryptoJS.lib.CipherParams =>
  CryptoJS.lib.CipherParams.create({ ciphertext });

const decryptLegacy = (data: Uint8Array, key: string): Uint8Array => {
  const keyWordArray = normalizeKeyLegacy(key);
  const ciphertext = uint8ArrayToWordArray(data);

  const decrypted = CryptoJS.DES.decrypt(createCipherParams(ciphertext), keyWordArray, {
    mode: CryptoJS.mode.ECB,
    padding: CryptoJS.pad.Pkcs7
  });

  // CryptoJS returns empty WordArray on failure or padding error sometimes, check sigBytes
  if (decrypted.sigBytes < 0) {
      throw new Error("Legacy decryption failed.");
  }

  return wordArrayToUint8Array(decrypted);
};

// --- New Implementation (AES-256-CBC + PBKDF2) ---

export const encryptUint8Array = (data: Uint8Array, key: string): Uint8Array => {
  // 1. Generate Salt
  const salt = CryptoJS.lib.WordArray.random(SALT_SIZE);

  // 2. Derive Key
  const derivedKey = CryptoJS.PBKDF2(key, salt, {
    keySize: KEY_SIZE,
    iterations: KEY_ITERATIONS
  });

  // 3. Generate IV
  const iv = CryptoJS.lib.WordArray.random(IV_SIZE);

  // 4. Encrypt with AES-CBC
  const dataWords = uint8ArrayToWordArray(data);
  const encrypted = CryptoJS.AES.encrypt(dataWords, derivedKey, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });

  // 5. Pack: HEADER + Salt + IV + Ciphertext
  const headerWords = CryptoJS.enc.Utf8.parse(HEADER_STRING);
  
  // Concat operations modify the first array in place for CryptoJS, so we chain carefully or clone if needed.
  // Ideally: Header -> concat(Salt) -> concat(IV) -> concat(Ciphertext)
  const resultWords = headerWords
    .concat(salt)
    .concat(iv)
    .concat(encrypted.ciphertext);

  return wordArrayToUint8Array(resultWords);
};

export const decryptUint8Array = (data: Uint8Array, key: string): Uint8Array => {
  if (isNewFormat(data)) {
    try {
      // 1. Parse Structure
      // Format: HEADER (6) | SALT (16) | IV (16) | CIPHERTEXT (...)
      const dataWords = uint8ArrayToWordArray(data);
      
      // We can't easily slice WordArrays by bytes in CryptoJS without being careful about word boundaries.
      // Easiest is to convert the whole thing to WordArray, then clone/slice specific parts?
      // Actually, since we have the byte array, it's safer to slice the Uint8Array first!
      
      let cursor = HEADER_LENGTH;
      const saltBytes = data.slice(cursor, cursor + SALT_SIZE);
      cursor += SALT_SIZE;
      
      const ivBytes = data.slice(cursor, cursor + IV_SIZE);
      cursor += IV_SIZE;
      
      const ciphertextBytes = data.slice(cursor);

      // 2. Convert to WordArrays
      const salt = uint8ArrayToWordArray(saltBytes);
      const iv = uint8ArrayToWordArray(ivBytes);
      const ciphertext = uint8ArrayToWordArray(ciphertextBytes);

      // 3. Derive Key
      const derivedKey = CryptoJS.PBKDF2(key, salt, {
        keySize: KEY_SIZE,
        iterations: KEY_ITERATIONS
      });

      // 4. Decrypt
      const decrypted = CryptoJS.AES.decrypt(createCipherParams(ciphertext), derivedKey, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      });
      
      return wordArrayToUint8Array(decrypted);

    } catch (error) {
       console.error("New format decryption failed:", error);
       throw new Error("Failed to decrypt secure SSTP file. Check password.");
    }
  } else {
    // Fallback for old files
    try {
      return decryptLegacy(data, key);
    } catch (error) {
       console.error("Legacy decryption failed:", error);
       throw new Error("Failed to decrypt SSTP file. Invalid password or corrupted file.");
    }
  }
};

export const encryptTextToBytes = (text: string, key: string): Uint8Array => {
  const inputBytes = textEncoder.encode(text);
  return encryptUint8Array(inputBytes, key);
};

export const decryptBytesToText = (data: Uint8Array, key: string): string => {
  const decryptedBytes = decryptUint8Array(data, key);
  return textDecoder.decode(decryptedBytes);
};
