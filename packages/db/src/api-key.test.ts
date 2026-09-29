import { describe, expect, it } from "vitest";

import { API_KEY_PREFIX, generateApiKey, hashApiKey } from "./api-key";

describe("generateApiKey", () => {
  it("returns a prefixed key whose hash and display prefix derive from it", () => {
    const { key, keyHash, keyPrefix } = generateApiKey();

    expect(key.startsWith(API_KEY_PREFIX)).toBe(true);
    expect(key.length).toBe(API_KEY_PREFIX.length + 43); // 32 bytes → 43 base64url chars
    expect(keyHash).toBe(hashApiKey(key));
    expect(keyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(keyPrefix).toBe(key.slice(API_KEY_PREFIX.length, API_KEY_PREFIX.length + 8));
  });

  it("never stores the plaintext in the hash or prefix", () => {
    const { key, keyHash, keyPrefix } = generateApiKey();
    expect(keyHash).not.toContain(key.slice(API_KEY_PREFIX.length));
    expect(keyPrefix.length).toBe(8);
  });

  it("generates distinct keys", () => {
    const hashes = new Set(Array.from({ length: 100 }, () => generateApiKey().keyHash));
    expect(hashes.size).toBe(100);
  });
});
