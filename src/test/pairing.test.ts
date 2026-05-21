/**
 * Pairing-code generator — must match the admin-side
 * `^[A-Z0-9]{12}$` pattern and be unique across calls.
 */

import { describe, expect, it } from "vitest";
import { generatePairingCode } from "../lib/pairing.js";

const ADMIN_PATTERN = /^[A-Z0-9]{12}$/;

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
