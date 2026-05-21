#!/usr/bin/env node
/**
 * @freewebstore/cli — entrypoint.
 *
 * Commands (mirror `fas` shape for muscle memory):
 *   fws init <slug> --category=<c>   scaffold a template directory
 *   fws doctor                       local pre-publish validation
 *   fws login                        install GitHub App
 *   fws logout                       clear local auth
 *   fws whoami                       show current auth
 *   fws publish                      upload to admin Worker
 *   fws status <slug>                check published template
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { doctorCommand } from "./commands/doctor.js";
import { initCommand } from "./commands/init.js";
import { loginCommand } from "./commands/login.js";
import { logoutCommand } from "./commands/logout.js";
import { publishCommand } from "./commands/publish.js";
import { statusCommand } from "./commands/status.js";
import { whoamiCommand } from "./commands/whoami.js";

// Read version from the package's own package.json so `fws --version`
// always matches the installed package. dist/index.js sits one level
// under the package root (where package.json lives).
const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf8")) as {
  version: string;
};

const program = new Command();

program
  .name("fws")
  .description(
    "FreeWebStore CLI — scaffold an HTML+Tailwind template, get credit on every small business site that uses it.",
  )
  .version(pkg.version);

program.addCommand(initCommand);
program.addCommand(doctorCommand);
program.addCommand(loginCommand);
program.addCommand(logoutCommand);
program.addCommand(whoamiCommand);
program.addCommand(publishCommand);
program.addCommand(statusCommand);

program.parseAsync(process.argv).catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
