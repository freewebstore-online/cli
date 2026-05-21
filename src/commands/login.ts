/**
 * `fws login`
 *
 * Browser-based GitHub App install flow with pairing-code polling.
 *
 *   1. CLI generates a 12-char pairing code (60 bits entropy)
 *   2. CLI prints + auto-opens `https://admin.freewebstore.online/api/auth/install?code=X`
 *   3. Admin redirects to the GitHub App install page with state=<code>
 *   4. Designer picks repo(s) and installs the App
 *   5. GitHub redirects back to admin's `/api/auth/github-app/callback`
 *   6. Admin persists DesignerRecord, marks pairing complete
 *   7. CLI polls `/api/auth/exchange` every 2s, up to 5 min
 *   8. On completion, CLI writes `~/.freewebstore/auth.json` and prints success
 *
 * Escape hatches:
 *   --installation-id <id> --github-login <login>     skip the browser flow
 *                                                     entirely (CI / testing)
 *   --no-browser                                      don't try to auto-open;
 *                                                     just print the URL
 *   --timeout <seconds>                               override the 5-min poll cap
 *
 * Why pairing-code + polling rather than a local HTTP listener:
 *   See ~/dev/stores/fws/admin/src/handlers/auth.ts header. Short version:
 *   listeners require an open port and fight WSL/devcontainer/corp-firewall
 *   environments. Polling adds a few seconds of latency but works everywhere.
 *   `gh` CLI moved off listeners for exactly this reason.
 */

import { spawn } from "node:child_process";
import { Command } from "commander";
import { ApiCallError, apiRequest } from "../lib/api.js";
import { adminBase, writeAuth } from "../lib/config.js";
import { generatePairingCode } from "../lib/pairing.js";

interface LoginOptions {
  installationId?: string;
  githubLogin?: string;
  noBrowser?: boolean;
  timeout?: string;
}

const DEFAULT_TIMEOUT_SECONDS = 300; // 5 min
const POLL_INTERVAL_MS = 2000;

export const loginCommand = new Command("login")
  .description("Authenticate by installing the FreeWebStore Templates GitHub App")
  .option(
    "--installation-id <id>",
    "Skip the browser flow and paste an installation_id directly (advanced)",
  )
  .option("--github-login <login>", "Required with --installation-id")
  .option("--no-browser", "Don't try to auto-open the browser; just print the URL")
  .option("--timeout <seconds>", "Polling timeout in seconds (default 300)")
  .action(async (opts: LoginOptions) => {
    // Escape-hatch path — paste known values, skip the dance.
    if (opts.installationId) {
      if (!opts.githubLogin) {
        console.error("error: --github-login is required when --installation-id is passed");
        process.exit(2);
      }
      writeAuth({
        v: 1,
        installation_id: opts.installationId,
        github_login: opts.githubLogin,
        admin_base: adminBase(),
        saved_at: new Date().toISOString(),
      });
      console.log(`✓ Saved auth for @${opts.githubLogin} (installation ${opts.installationId})`);
      return;
    }

    // Standard browser flow.
    const code = generatePairingCode();
    const installUrl = `${adminBase()}/api/auth/install?code=${code}`;
    const timeoutSeconds = Number.parseInt(opts.timeout ?? String(DEFAULT_TIMEOUT_SECONDS), 10);
    if (!Number.isFinite(timeoutSeconds) || timeoutSeconds < 10 || timeoutSeconds > 3600) {
      console.error("error: --timeout must be 10-3600 seconds");
      process.exit(2);
    }

    console.log("FreeWebStore login");
    console.log("");
    console.log("Open this URL in your browser to install the GitHub App:");
    console.log("");
    console.log(`  ${installUrl}`);
    console.log("");
    console.log("Pick the repo or org where your template will live, then approve.");
    console.log(`Waiting up to ${timeoutSeconds}s for you to complete the install...`);
    console.log("");

    if (!opts.noBrowser) {
      tryOpenBrowser(installUrl);
    }

    try {
      const identity = await pollForCompletion(code, timeoutSeconds);
      writeAuth({
        v: 1,
        installation_id: identity.installation_id,
        github_login: identity.github_login,
        admin_base: adminBase(),
        saved_at: new Date().toISOString(),
      });
      console.log(`✓ Signed in as @${identity.github_login}`);
      console.log(`  installation: ${identity.installation_id}`);
      console.log(`  admin base:   ${adminBase()}`);
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
  installation_id: string;
  github_login: string;
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
      { noAuth: true },
    );

    if (res.ok && res.status === 200) {
      return res.body;
    }
    if (res.ok && res.status === 202) {
      // Still pending — designer hasn't completed the install yet.
      consecutiveErrors = 0;
    } else if (res.status === 404) {
      // Pairing expired or never existed; admin discarded it.
      throw new ApiCallError(
        res.ok ? { ok: false, status: 404, body: { error: "pairing expired" } } : res,
      );
    } else {
      // Transient network/upstream error — back off and retry, but bail
      // after 5 consecutive failures to avoid spinning forever on a
      // broken admin.
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

/** Best-effort browser open. Doesn't block; failures are silent because
 *  the printed URL is the visible fallback. */
function tryOpenBrowser(url: string): void {
  const platform = process.platform;
  let cmd: string;
  let args: string[];
  if (platform === "darwin") {
    cmd = "open";
    args = [url];
  } else if (platform === "win32") {
    // `start` is a cmd builtin; need to spawn through cmd.exe. The empty
    // "" first arg is a quirk of `start` — it treats the first quoted
    // string as the window title.
    cmd = "cmd";
    args = ["/c", "start", '""', url];
  } else {
    cmd = "xdg-open";
    args = [url];
  }
  try {
    const proc = spawn(cmd, args, { stdio: "ignore", detached: true });
    proc.on("error", () => {
      // Browser open failed; silent — the printed URL is the fallback.
    });
    proc.unref();
  } catch {
    // Same — printed URL is the fallback.
  }
}
