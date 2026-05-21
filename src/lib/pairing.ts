/**
 * Pairing-code generation for the `fws login` flow.
 *
 * 12 characters from a 32-character alphabet ([A-Z0-9]). Entropy is
 * 12 × log2(32) = 60 bits — comparable to a passwordless email-link
 * token and well past what's needed to defend a 10-minute KV TTL
 * against guessing. Reject visually ambiguous chars (0/O, 1/I/L) so the
 * code can be read off a terminal aloud during ops debugging.
 */

import { randomBytes } from "node:crypto";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // skip O/I/L/0/1
const CODE_LEN = 12;

export function generatePairingCode(): string {
  // Match the admin-side pattern `^[A-Z0-9]{12}$`. The skip-list above
  // narrows our chars to a 31-symbol alphabet so the regex still accepts
  // every code we produce.
  const bytes = randomBytes(CODE_LEN);
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}
