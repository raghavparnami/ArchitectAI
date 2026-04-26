import 'server-only';
import sodium from 'libsodium-wrappers';

/**
 * Per-user LLM API key envelope encryption.
 *
 * Threat model:
 *   - DB compromise alone does NOT yield plaintext keys (envelope is
 *     encrypted with a server-side secret).
 *   - Server compromise yields plaintext keys; we accept that — the
 *     alternative is HSM-backed encryption, which is overkill for the
 *     current scale.
 *
 * Cipher choice: libsodium secretbox (XSalsa20-Poly1305). Authenticated
 * AEAD, fixed at the spec level — no algorithm-confusion attacks.
 *
 * Key rotation: see `reencrypt()` for the supported migration path.
 */

const KEY_ENV = 'LLM_KEY_ENCRYPTION_SECRET';
let readyPromise: Promise<void> | null = null;
let masterKey: Uint8Array | null = null;

async function ensureReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      await sodium.ready;
      const b64 = process.env[KEY_ENV];
      if (!b64) {
        throw new Error(
          `${KEY_ENV} is not set. Generate one with:\n` +
            `  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
        );
      }
      const key = sodium.from_base64(b64, sodium.base64_variants.ORIGINAL);
      if (key.length !== sodium.crypto_secretbox_KEYBYTES) {
        throw new Error(
          `${KEY_ENV} must decode to ${sodium.crypto_secretbox_KEYBYTES} bytes; got ${key.length}.`
        );
      }
      masterKey = key;
    })();
  }
  await readyPromise;
}

export type EncryptedBlob = {
  /** base64 ciphertext (libsodium ORIGINAL alphabet) */
  ciphertext: string;
  /** base64 nonce */
  nonce: string;
};

export async function encryptApiKey(plaintext: string): Promise<EncryptedBlob> {
  await ensureReady();
  if (!masterKey) throw new Error('master key not initialized');

  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const message = sodium.from_string(plaintext);
  const ciphertext = sodium.crypto_secretbox_easy(message, nonce, masterKey);

  return {
    ciphertext: sodium.to_base64(ciphertext, sodium.base64_variants.ORIGINAL),
    nonce: sodium.to_base64(nonce, sodium.base64_variants.ORIGINAL),
  };
}

export async function decryptApiKey(blob: EncryptedBlob): Promise<string> {
  await ensureReady();
  if (!masterKey) throw new Error('master key not initialized');

  const nonce = sodium.from_base64(blob.nonce, sodium.base64_variants.ORIGINAL);
  const ciphertext = sodium.from_base64(
    blob.ciphertext,
    sodium.base64_variants.ORIGINAL
  );
  const plaintext = sodium.crypto_secretbox_open_easy(ciphertext, nonce, masterKey);
  return sodium.to_string(plaintext);
}

/**
 * Re-encrypt a blob under a new master key. Use when rotating
 * `LLM_KEY_ENCRYPTION_SECRET`: decrypt with the OLD key (passed in),
 * then call `encryptApiKey` while the NEW key is the one in env.
 */
export async function reencrypt(
  oldKeyB64: string,
  blob: EncryptedBlob
): Promise<EncryptedBlob> {
  await sodium.ready;
  const oldKey = sodium.from_base64(oldKeyB64, sodium.base64_variants.ORIGINAL);
  const nonce = sodium.from_base64(blob.nonce, sodium.base64_variants.ORIGINAL);
  const ciphertext = sodium.from_base64(
    blob.ciphertext,
    sodium.base64_variants.ORIGINAL
  );
  const plaintext = sodium.crypto_secretbox_open_easy(ciphertext, nonce, oldKey);
  const plaintextString = sodium.to_string(plaintext);
  return encryptApiKey(plaintextString);
}

/**
 * Returns a redacted preview suitable for logging or UI display:
 *   sk-…ABCD (last 4 chars only).
 * NEVER log the full key.
 */
export function previewKey(plaintext: string): string {
  if (plaintext.length <= 6) return '****';
  return `${plaintext.slice(0, 3)}…${plaintext.slice(-4)}`;
}
