import { createHash, randomBytes } from "node:crypto";

/** Product prefix: makes leaked keys greppable and detectable by secret scanners. */
export const API_KEY_PREFIX = "aegis_sk_";

export const API_KEY_DISPLAY_PREFIX_LENGTH = 8;

export interface GeneratedApiKey {
  /** Plaintext key: return it to the user once, never persist or log it. */
  key: string;
  /** What goes in api_keys.key_hash. */
  keyHash: string;
  /** What goes in api_keys.key_prefix: first chars of the random part, safe to display. */
  keyPrefix: string;
}

/**
 * SHA-256 is sufficient (no bcrypt/argon2 needed): the key carries 256 bits of entropy, so it can't be
 * brute-forced, and a fast deterministic hash allows the unique-index lookup on every request.
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

export function generateApiKey(): GeneratedApiKey {
  const secret = randomBytes(32).toString("base64url");
  const key = `${API_KEY_PREFIX}${secret}`;
  return {
    key,
    keyHash: hashApiKey(key),
    keyPrefix: secret.slice(0, API_KEY_DISPLAY_PREFIX_LENGTH),
  };
}
