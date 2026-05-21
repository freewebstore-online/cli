/**
 * `fws status <slug>`
 *
 * Fetches the public TemplateRecord from the admin Worker and prints
 * a compact status report. Used by designers waiting for compliance +
 * review to finish, and by CI checks in template repos.
 *
 * Exit code: 0 if public, 1 if still pending or rejected, 2 if not
 * found. So `fws publish && fws status $SLUG` works in a wait-loop.
 */

import { Command } from "commander";
import { ApiCallError, apiCall } from "../lib/api.js";

interface TemplateView {
  slug: string;
  category: string;
  author: { handle: string; name: string };
  preview_url: string;
  repo_url: string;
  slot_schema_version: number;
  active_sites: number;
  approved_at?: string;
}

export const statusCommand = new Command("status")
  .description("Show the current status of a published template")
  .argument("<slug>", "Template slug, e.g. sofia-bistro")
  .action(async (slug: string) => {
    try {
      const t = await apiCall<TemplateView>(
        "GET",
        `/api/templates/${encodeURIComponent(slug)}`,
        undefined,
        {
          noAuth: true,
        },
      );
      console.log(`slug:           ${t.slug}`);
      console.log(`category:       ${t.category}`);
      console.log(`author:         @${t.author.handle} (${t.author.name})`);
      console.log(`preview:        ${t.preview_url}`);
      console.log(`repo:           ${t.repo_url}`);
      console.log(`slot schema:    v${t.slot_schema_version}`);
      console.log(`active sites:   ${t.active_sites}`);
      if (t.approved_at) console.log(`approved at:    ${t.approved_at}`);
      console.log("");
      console.log("status: public");
    } catch (e) {
      if (e instanceof ApiCallError) {
        if (e.response.status === 404) {
          console.error(`not found: ${slug}`);
          console.error(
            "(template may be still in compliance/review — try again in a few minutes)",
          );
          process.exit(2);
        }
        console.error(`error: ${e.message}`);
        process.exit(1);
      }
      throw e;
    }
  });
