/**
 * Designer auth state lives in `~/.freewebstore/auth.json`.
 *
 * v2 (current): GitHub OAuth — stores designer_token + github_login.
 * v1 (legacy):  GitHub App install — stores installation_id.
 * Both are accepted; `fws login` writes v2.
 */

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const DEFAULT_ADMIN_BASE = "https://admin.freewebstore.online";

export interface AuthConfigV2 {
  v: 2;
  github_login: string;
  designer_token: string;
  admin_base: string;
  saved_at: string;
}

export interface AuthConfigV1 {
  v: 1;
  installation_id: string;
  github_login: string;
  admin_base: string;
  saved_at: string;
}

export type AuthConfig = AuthConfigV1 | AuthConfigV2;

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
    const parsed = JSON.parse(raw);
    if (parsed.v === 2 || parsed.v === 1) return parsed as AuthConfig;
    return null;
  } catch {
    return null;
  }
}

export function writeAuth(auth: AuthConfig): void {
  const path = authPath();
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, JSON.stringify(auth, null, 2), { mode: 0o600 });
}

export function clearAuth(): boolean {
  const path = authPath();
  if (!existsSync(path)) return false;
  writeFileSync(path, "{}", { mode: 0o600 });
  try {
    unlinkSync(path);
  } catch {}
  return true;
}

/** Resolve the admin base URL. */
export function adminBase(): string {
  if (process.env.FREEWEBSTORE_ADMIN_BASE) return process.env.FREEWEBSTORE_ADMIN_BASE;
  const auth = readAuth();
  if (auth?.admin_base) return auth.admin_base;
  return DEFAULT_ADMIN_BASE;
}
