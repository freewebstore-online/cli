/**
 * Designer auth state lives in `~/.freewebstore/auth.json`. The CLI
 * writes the GitHub App installation_id + a long-lived refresh token
 * after `fws login`, and reads them before every `fws publish`.
 *
 * Honors `$FREEWEBSTORE_CONFIG_DIR` so tests don't touch the real home
 * directory, and so users with non-standard home dirs (CI, NixOS) can
 * relocate without arg-passing.
 *
 *   auth.json shape (v1):
 *     {
 *       "v": 1,
 *       "installation_id": "12345678",
 *       "github_login": "sofia-dev",
 *       "admin_base": "https://admin.freewebstore.online",
 *       "saved_at": "2026-05-21T11:00:00Z"
 *     }
 */

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const DEFAULT_ADMIN_BASE = "https://admin.freewebstore.online";

export interface AuthConfig {
  v: 1;
  installation_id: string;
  github_login: string;
  admin_base: string;
  saved_at: string;
}

export function configDir(): string {
  return process.env.FREEWEBSTORE_CONFIG_DIR ?? join(homedir(), ".freewebstore");
}

export function authPath(): string {
  return join(configDir(), "auth.json");
}

export function readAuth(): AuthConfig | null {
  const path = authPath();
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, "utf8");
    const parsed = JSON.parse(raw) as AuthConfig;
    if (parsed.v !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeAuth(auth: AuthConfig): void {
  const path = authPath();
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  // 0o600 so other users on the host can't read the token. Matches `gh`
  // and `aws` CLI defaults.
  writeFileSync(path, JSON.stringify(auth, null, 2), { mode: 0o600 });
}

export function clearAuth(): boolean {
  const path = authPath();
  if (!existsSync(path)) return false;
  // Overwrite then unlink — paranoid but cheap on a small file. If
  // unlink fails (perms / racing test cleanup), the overwrite already
  // made the token unrecoverable.
  writeFileSync(path, "{}", { mode: 0o600 });
  try {
    unlinkSync(path);
  } catch {
    // ignore — see comment above
  }
  return true;
}

/** Resolve the admin base URL. Precedence:
 *    1. $FREEWEBSTORE_ADMIN_BASE (override for local dev / staging)
 *    2. saved auth's admin_base (so a designer logged into staging stays there)
 *    3. production default
 */
export function adminBase(): string {
  if (process.env.FREEWEBSTORE_ADMIN_BASE) return process.env.FREEWEBSTORE_ADMIN_BASE;
  const auth = readAuth();
  if (auth?.admin_base) return auth.admin_base;
  return DEFAULT_ADMIN_BASE;
}
