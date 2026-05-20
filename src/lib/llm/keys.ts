import 'server-only';

// ─── DEMO SCOPE-DOWN ────────────────────────────────────────────────────────
// BYO LLM keys (libsodium envelope encryption) are out of scope for the
// trimmed demo build. The full implementation lived here; it's preserved in
// git history. These stubs let `llm-keys` router and `llm/client.ts` keep
// compiling without dragging libsodium-wrappers into the bundle (the package
// has unusual ESM packaging that broke Turbopack's standalone output).
//
// To restore: `git log -- src/lib/llm/keys.ts` and revert to the libsodium
// implementation, then add `libsodium-wrappers` back to serverExternalPackages
// in next.config.ts and ensure the node_modules entry is copied into the
// Docker runner stage.

export type EncryptedBlob = {
  ciphertext: string;
  nonce: string;
};

const NOT_SUPPORTED =
  'BYO LLM keys are disabled in this build. Use server-default env keys instead.';

export async function encryptApiKey(_plaintext: string): Promise<EncryptedBlob> {
  throw new Error(NOT_SUPPORTED);
}

export async function decryptApiKey(_blob: EncryptedBlob): Promise<string> {
  throw new Error(NOT_SUPPORTED);
}

export async function reencrypt(
  _blob: EncryptedBlob,
  _previousSecretB64: string
): Promise<EncryptedBlob> {
  throw new Error(NOT_SUPPORTED);
}

export function previewKey(plaintext: string): string {
  if (!plaintext) return '';
  if (plaintext.length <= 8) return '••••';
  return `${plaintext.slice(0, 3)}…${plaintext.slice(-3)}`;
}
