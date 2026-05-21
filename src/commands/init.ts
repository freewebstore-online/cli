/**
 * `fws init <slug> --category=<category> [--author=<handle>] [--path=<dir>]`
 *
 * Scaffolds a new template directory. Writes the starter files from
 * `lib/scaffold.ts`. Does NOT contact the admin Worker — init is local.
 *
 * Author handle defaults to the value from `~/.freewebstore/auth.json`
 * if the designer has run `fws login`; otherwise the designer can pass
 * `--author=handle` or get a placeholder they can fix before publishing.
 *
 * Fails if the target directory already exists with files inside (we
 * don't want to clobber a designer's work-in-progress). Empty target
 * directories are fine — they get filled in.
 */

import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Command } from "commander";
import { readAuth } from "../lib/config.js";
import { scaffoldFiles } from "../lib/scaffold.js";

const SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const SLUG_MAX_LEN = 48;

interface InitOptions {
  category: string;
  author?: string;
  path?: string;
}

export const initCommand = new Command("init")
  .description("Scaffold a new FreeWebStore template directory")
  .argument("<slug>", "URL-safe slug, e.g. sofia-bistro")
  .requiredOption("--category <category>", "Category, e.g. restaurant.italian")
  .option("--author <handle>", "GitHub handle of the author")
  .option("--path <dir>", "Target directory (defaults to ./<slug>)")
  .action((slug: string, opts: InitOptions) => {
    if (slug.length > SLUG_MAX_LEN || !SLUG_PATTERN.test(slug)) {
      console.error(
        `error: slug "${slug}" is invalid. Must be 1-${SLUG_MAX_LEN} chars, lowercase letters/digits/hyphens, not start/end with hyphen.`,
      );
      process.exit(2);
    }

    const auth = readAuth();
    const authorHandle = opts.author ?? auth?.github_login ?? "your-handle";

    const targetDir = resolve(opts.path ?? slug);
    if (existsSync(targetDir)) {
      const contents = readdirSync(targetDir).filter((f) => !f.startsWith("."));
      if (contents.length > 0) {
        console.error(
          `error: ${targetDir} already exists and is not empty. Refusing to clobber existing files.`,
        );
        process.exit(2);
      }
    } else {
      mkdirSync(targetDir, { recursive: true });
    }

    const files = scaffoldFiles({ slug, category: opts.category, authorHandle });
    for (const file of files) {
      const fullPath = resolve(targetDir, file.path);
      mkdirSync(dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, file.content, { mode: file.mode ?? 0o644 });
    }

    console.log(`✓ Scaffolded ${files.length} files in ${targetDir}`);
    console.log("");
    console.log("Next:");
    console.log(`  cd ${opts.path ?? slug}`);
    console.log("  # open index.html in your editor and vibecode the design");
    console.log("  # add a preview.png (1280×720) when ready");
    console.log("  npx @freewebstore/cli doctor   # validate before publish");
    if (!auth) {
      console.log("  npx @freewebstore/cli login    # one-time GitHub App install");
    }
    console.log("  npx @freewebstore/cli publish");
  });
