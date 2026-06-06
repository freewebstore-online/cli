/**
 * `fws login`
 *
 * Browser-based GitHub OAuth flow with pairing-code polling.
 *
 *   1. CLI generates a 12-char pairing code (60 bits entropy)
 *   2. CLI prints + auto-opens `https://admin.freewebstore.online/api/auth/login?code=X`
 *   3. Admin redirects to GitHub OAuth authorize page
 *   4. Designer signs in with GitHub (no App install needed)
 *   5. GitHub redirects back to admin's `/api/auth/github/callback`
 *   6. Admin persists DesignerRecord, marks pairing complete
 *   7. CLI polls `/api/auth/exchange` every 2s, up to 5 min
 *   8. On completion, CLI writes `~/.freewebstore/auth.json` and prints success
 *
 * The designer does NOT need to be a member of the freewebstore-online org.
 * The platform creates template repos in the org on their behalf using the
 * GitHub App's own org-level permissions.
 */

import { spawn } from "node:child_process";
import { Command } from "commander";
import { ApiCallError, apiRequest } from "../lib/api.js";
import { adminBase, agentBase, writeAuth } from "../lib/config.js";
import { generatePairingCode } from "../lib/pairing.js";

interface LoginOptions {
  noBrowser?: boolean;
  timeout?: string;
}

const DEFAULT_TIMEOUT_SECONDS = 300; // 5 min
const POLL_INTERVAL_MS = 2000;

export const loginCommand = new Command("login")
  .description("Sign in with GitHub (opens browser)")
  .option("--no-browser", "Don't try to auto-open the browser; just print the URL")
  .option("--timeout <seconds>", "Polling timeout in seconds (default 300)")
  .action(async (opts: LoginOptions) => {
    const code = generatePairingCode();
    const loginUrl = `${adminBase()}/api/auth/login?code=${code}`;
    const timeoutSeconds = Number.parseInt(opts.timeout ?? String(DEFAULT_TIMEOUT_SECONDS), 10);
    if (!Number.isFinite(timeoutSeconds) || timeoutSeconds < 10 || timeoutSeconds > 3600) {
      console.error("error: --timeout must be 10-3600 seconds");
      process.exit(2);
    }

    console.log("FreeWebStore login");
    console.log("");
    console.log("Open this URL in your browser to sign in with GitHub:");
    console.log("");
    console.log(`  ${loginUrl}`);
    console.log("");
    console.log("You do NOT need to be a member of any org.");
    console.log(`Waiting up to ${timeoutSeconds}s for you to complete sign-in...`);
    console.log("");

    if (!opts.noBrowser) {
      tryOpenBrowser(loginUrl);
    }

    try {
      const identity = await pollForCompletion(code, timeoutSeconds);
      writeAuth({
        v: 2,
        github_login: identity.github_login,
        designer_token: identity.designer_token,
        admin_base: adminBase(),
        saved_at: new Date().toISOString(),
      });
      console.log(`✓ Signed in as @${identity.github_login}`);
      console.log(`  admin base: ${adminBase()}`);
    } catch (e) {
      if (e instanceof LoginTimeoutError) {
        console.error("");
        console.error("error: timed out waiting for the browser flow to complete.");
        console.error("Run `fws login` again. If the browser didn't open, copy the URL above.");
        process.exit(1);
      }
      console.error("error:", e instanceof Error ? e.message : String(e));
      process.exit(1);
    }
  });

class LoginTimeoutError extends Error {
  constructor() {
    super("login timeout");
    this.name = "LoginTimeoutError";
  }
}

interface CompletedIdentity {
  github_login: string;
  designer_token: string;
}

async function pollForCompletion(
  pairingCode: string,
  timeoutSeconds: number,
): Promise<CompletedIdentity> {
  const deadline = Date.now() + timeoutSeconds * 1000;
  let consecutiveErrors = 0;

  while (Date.now() < deadline) {
    const res = await apiRequest<CompletedIdentity>(
      "POST",
      "/api/auth/exchange",
      { pairing_code: pairingCode },
      { noAuth: true, base: agentBase() },
    );

    if (res.ok && res.status === 200) {
      if (!res.body?.github_login || !res.body?.designer_token) {
        throw new Error("exchange returned 200 but missing github_login or designer_token");
      }
      return res.body;
    }
    if (res.ok && res.status === 202) {
      consecutiveErrors = 0;
    } else if (res.status === 404) {
      throw new ApiCallError(
        res.ok ? { ok: false, status: 404, body: { error: "pairing expired" } } : res,
      );
    } else {
      consecutiveErrors++;
      if (consecutiveErrors >= 5) {
        throw new Error(
          `admin exchange endpoint is failing repeatedly (last status ${res.status})`,
        );
      }
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new LoginTimeoutError();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tryOpenBrowser(url: string): void {
  const platform = process.platform;
  let cmd: string;
  let args: string[];
  if (platform === "darwin") {
    cmd = "open";
    args = [url];
  } else if (platform === "win32") {
    cmd = "cmd";
    args = ["/c", "start", '""', url];
  } else {
    cmd = "xdg-open";
    args = [url];
  }
  try {
    const proc = spawn(cmd, args, { stdio: "ignore", detached: true });
    proc.on("error", () => {});
    proc.unref();
  } catch {}
}
