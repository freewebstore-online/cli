/**
 * Pairing-code generator — must match the admin-side
 * `^[A-Z0-9]{12}$` pattern and be unique across calls.
 */

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { computeChallenge, generatePairingCode, generateVerifier } from "../lib/pairing.js";

const ADMIN_PATTERN = /^[A-Z0-9]{12}$/;
// base64url alphabet, no padding.
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

describe("generatePairingCode", () => {
  it("produces 12 characters", () => {
    const code = generatePairingCode();
    expect(code).toHaveLength(12);
  });

  it("matches the admin-side regex pattern", () => {
    for (let i = 0; i < 100; i++) {
      const code = generatePairingCode();
      expect(code).toMatch(ADMIN_PATTERN);
    }
  });

  it("does not use visually ambiguous characters (0/1/I/L/O)", () => {
    for (let i = 0; i < 200; i++) {
      const code = generatePairingCode();
      expect(code).not.toMatch(/[01ILO]/);
    }
  });

  it("produces unique codes across calls", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 200; i++) {
      codes.add(generatePairingCode());
    }
    // 60 bits of entropy → collisions in 200 samples are astronomically unlikely.
    expect(codes.size).toBe(200);
  });
});

describe("generateVerifier", () => {
  it("produces a base64url string with no padding", () => {
    const verifier = generateVerifier();
    expect(verifier).toMatch(BASE64URL_PATTERN);
    expect(verifier).not.toContain("=");
  });

  it("carries at least 32 bytes of entropy", () => {
    // 32 bytes → 43 base64url chars (no padding). Length must be >= that.
    const verifier = generateVerifier();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
  });

  it("produces unique verifiers across calls", () => {
    const set = new Set<string>();
    for (let i = 0; i < 200; i++) set.add(generateVerifier());
    expect(set.size).toBe(200);
  });
});

describe("computeChallenge", () => {
  it("equals base64url(sha256(verifier))", () => {
    const verifier = generateVerifier();
    const expected = createHash("sha256")
      .update(verifier)
      .digest("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    expect(computeChallenge(verifier)).toBe(expected);
  });

  it("is deterministic for the same verifier", () => {
    const verifier = generateVerifier();
    expect(computeChallenge(verifier)).toBe(computeChallenge(verifier));
  });

  it("produces a 43-char base64url challenge (sha256 digest)", () => {
    const challenge = computeChallenge(generateVerifier());
    expect(challenge).toHaveLength(43);
    expect(challenge).toMatch(BASE64URL_PATTERN);
  });

  it("differs from the verifier (never leaks the secret)", () => {
    const verifier = generateVerifier();
    expect(computeChallenge(verifier)).not.toBe(verifier);
  });
});
