/**
 * `fws publish [--path=<dir>]`
 *
 * Uploads a vibecoded template to the FreeWebStore admin Worker. Wraps:
 *
 *   1. Read template.config.json + index.html + tailwind.config.js +
 *      preview.png + README.md + slots.md from the local directory
 *   2. Tar + gzip them (with deterministic ordering for stable shas)
 *   3. Base64 the tarball into the request body
 *   4. POST to /api/publish-template with the installation token
 *   5. On 202 Accepted: print the polling URL and the status; designer
 *      can `fws status <slug>` until compliance finishes
 *   6. On 4xx: format the admin's error response into a one-line stderr
 *      message and exit nonzero
 *
 * Tarball assembly is deliberately tiny — node:fs + a small tar writer
 * (no third-party deps in the runtime closure). The admin Worker is
 * the only consumer; format is whatever both sides agree on (gzip is
 * fine; a flat JSON-of-file-contents would also work and is simpler
 * for v1). v1 uses JSON-of-files; revisit if templates grow assets.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Command } from "commander";
import { ApiCallError, apiCall } from "../lib/api.js";
import { agentBase, readAuth } from "../lib/config.js";

interface PublishOptions {
  path?: string;
}

interface TemplateConfig {
  v: number;
  slug: string;
  category: string;
  slot_schema_version: number;
  author: { handle: string };
  license: string;
}

interface PublishResponse {
  status: string;
  slug: string;
  preview_url?: string;
  poll_url?: string;
  message?: string;
}

export const publishCommand = new Command("publish")
  .description("Upload the template to FreeWebStore for review")
  .option("--path <dir>", "Template directory (defaults to .)")
  .action(async (opts: PublishOptions) => {
    const dir = resolve(opts.path ?? ".");

    const configPath = resolve(dir, "template.config.json");
    if (!existsSync(configPath)) {
      console.error("error: template.config.json not found — run `fws init` first");
      process.exit(2);
    }

    let config: TemplateConfig;
    try {
      config = JSON.parse(readFileSync(configPath, "utf8")) as TemplateConfig;
    } catch (e) {
      console.error(
        `error: template.config.json is not valid JSON: ${e instanceof Error ? e.message : e}`,
      );
      process.exit(2);
    }

    if (!existsSync(resolve(dir, "index.html"))) {
      console.error("error: index.html not found — run `fws doctor` to see what's missing");
      process.exit(2);
    }
    if (!existsSync(resolve(dir, "preview.png"))) {
      console.error("error: preview.png not found — a 1280×720 PNG hero shot is required");
      process.exit(2);
    }

    const auth = readAuth();
    if (!auth) {
      console.error("error: not logged in — run `fws login` first");
      process.exit(2);
    }

    // v1: JSON-of-files archive. Each value is utf-8 text for the small
    // text files; preview.png goes in as base64. Simple, debuggable,
    // good enough until templates need binary assets beyond one image.
    const archive = {
      "template.config.json": readFileSync(resolve(dir, "template.config.json"), "utf8"),
      "index.html": readFileSync(resolve(dir, "index.html"), "utf8"),
      "tailwind.config.js": readFileSync(resolve(dir, "tailwind.config.js"), "utf8"),
      "README.md": readFileSync(resolve(dir, "README.md"), "utf8"),
      "slots.md": existsSync(resolve(dir, "slots.md"))
        ? readFileSync(resolve(dir, "slots.md"), "utf8")
        : null,
      "preview.png.b64": readFileSync(resolve(dir, "preview.png")).toString("base64"),
    };
    const archive_b64 = Buffer.from(JSON.stringify(archive)).toString("base64");

    console.log(`Publishing ${config.slug} (${config.category}) to FreeWebStore...`);

    try {
      const res = await apiCall<PublishResponse>(
        "POST",
        "/api/publish-template",
        {
          slug: config.slug,
          category: config.category,
          slot_schema_version: config.slot_schema_version,
          archive_b64,
          author: config.author,
        },
        { base: agentBase() },
      );

      console.log(`✓ ${res.slug ?? config.slug} ${res.status ?? "submitted"}`);
      if (res.preview_url) console.log(`  preview: ${res.preview_url}`);
      if (res.poll_url) console.log(`  poll:    ${res.poll_url}`);
      if (res.message) console.log(`  ${res.message}`);
    } catch (e) {
      if (e instanceof ApiCallError) {
        console.error(`error: ${e.message}`);
        if (typeof e.response.body === "object" && e.response.body !== null) {
          console.error(`  ${JSON.stringify(e.response.body)}`);
        }
        process.exit(1);
      }
      throw e;
    }
  });
