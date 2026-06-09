/**
 * `fws status <slug>`
 *
 * Fetches the TemplateRecord from the agent and prints a compact status
 * report. Shows pending/compliance status as well as public templates.
 *
 * Exit code: 0 if public, 1 if still pending or rejected, 2 if not found.
 */

import { Command } from "commander";
import { ApiCallError, apiCall } from "../lib/api.js";
import { agentBase } from "../lib/config.js";

interface TemplateResponse {
  status?: string;
  slug?: string;
  category?: string;
  author?: { handle: string; name: string };
  preview_url?: string;
  repo_url?: string;
  slot_schema_version?: number;
  active_sites?: number;
  approved_at?: string;
}

export const statusCommand = new Command("status")
  .description("Show the current status of a published template")
  .argument("<slug>", "Template slug, e.g. sofia-bistro")
  .action(async (slug: string) => {
    try {
      const t = await apiCall<TemplateResponse>(
        "GET",
        `/api/templates/${encodeURIComponent(slug)}`,
        undefined,
        { noAuth: true, base: agentBase() },
      );

      const status = t.status ?? "public";
      console.log(`slug:           ${t.slug ?? slug}`);
      console.log(`status:         ${status}`);

      if (status !== "pending_compliance" && status !== "public") {
        console.log("");
        console.log(`Template is in "${status}" state.`);
        process.exit(1);
      }

      if (status === "pending_compliance") {
        console.log("");
        console.log("Compliance checks are running. Template will go public automatically once they pass.");
        console.log("Re-run `fws status` in a minute.");
        process.exit(1);
      }

      if (t.category) console.log(`category:       ${t.category}`);
      if (t.author) console.log(`author:         @${t.author.handle} (${t.author.name})`);
      if (t.preview_url) console.log(`preview:        ${t.preview_url}`);
      if (t.repo_url) console.log(`repo:           ${t.repo_url}`);
      if (t.slot_schema_version != null) console.log(`slot schema:    v${t.slot_schema_version}`);
      console.log(`active sites:   ${t.active_sites ?? 0}`);
      if (t.approved_at) console.log(`approved at:    ${t.approved_at}`);
    } catch (e) {
      if (e instanceof ApiCallError) {
        if (e.response.status === 404) {
          console.error(`not found: ${slug}`);
          console.error("(template was not found — check the slug and try `fws publish` first)");
          process.exit(2);
        }
        console.error(`error: ${e.message}`);
        process.exit(1);
      }
      throw e;
    }
  });
