/**
 * `fws whoami [--verify]`
 *
 * Default: prints the local auth state from `~/.freewebstore/auth.json`.
 * Fast, offline, no network.
 *
 * With --verify: also queries the admin Worker's `/api/auth/whoami` to
 * confirm the stored installation still resolves to a DesignerRecord.
 * Useful for "is my auth still good?" checks before a big publish.
 */

import { Command } from "commander";
import { ApiCallError, apiCall } from "../lib/api.js";
import { adminBase, agentBase, authPath, readAuth } from "../lib/config.js";

interface RemoteIdentity {
  installation_id: string;
  github_login: string;
  display_name?: string;
  template_count: number;
  first_seen_at: string;
}

export const whoamiCommand = new Command("whoami")
  .description("Show current auth state")
  .option("--verify", "Also query the admin Worker to confirm the auth is still live")
  .action(async (opts: { verify?: boolean }) => {
    const auth = readAuth();
    if (!auth) {
      console.log("not logged in");
      console.log(`(auth file would be at ${authPath()})`);
      process.exit(1);
    }
    console.log(`github login:    @${auth.github_login}`);
    if (auth.v === 1) console.log(`installation:    ${auth.installation_id}`);
    console.log(`auth version:    v${auth.v}`);
    console.log(`admin base:      ${adminBase()}`);
    console.log(`logged in since: ${auth.saved_at}`);

    if (!opts.verify) return;

    try {
      const remote = await apiCall<RemoteIdentity>("GET", "/api/auth/whoami", undefined, { base: agentBase() });
      console.log("");
      console.log(`✓ admin confirmed @${remote.github_login}`);
      console.log(`  templates:     ${remote.template_count}`);
      console.log(`  first seen:    ${remote.first_seen_at}`);
      if (remote.display_name && remote.display_name !== remote.github_login) {
        console.log(`  display name:  ${remote.display_name}`);
      }
    } catch (e) {
      if (e instanceof ApiCallError) {
        console.error("");
        console.error(`✗ admin verification failed: ${e.message}`);
        if (e.response.status === 404) {
          console.error("  (no designer record on the admin — run `fws login` to re-create it)");
        }
        process.exit(2);
      }
      throw e;
    }
  });
