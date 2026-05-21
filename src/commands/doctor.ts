/**
 * `fws doctor [--path=<dir>]`
 *
 * Local pre-publish validation. Runs the same checks the admin Worker's
 * compliance step will run, in the same order, but on the designer's
 * laptop where errors are cheap to fix. Catches the majority of bounces
 * before they ever leave the machine.
 *
 * Checks (mirror admin/src/handlers/publish-template.ts):
 *   ✓ template.config.json exists, parses, has required fields
 *   ✓ slug matches pattern (lowercase, hyphens, ≤48 chars)
 *   ✓ index.html exists, is valid-ish HTML, has at least one slot marker
 *   ✓ preview.png exists, is a PNG, ≤500KB
 *   ✓ tailwind.config.js exists (locked config marker)
 *   ✓ README.md exists
 *   ✓ no external <script> tags except the Tailwind CDN
 *
 * Exit code 0 on pass, 1 on any failure. Output is human-readable with
 * a final summary so designers can fix-and-rerun fast.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { Command } from "commander";

interface DoctorOptions {
  path?: string;
}

interface Check {
  name: string;
  status: "pass" | "fail";
  message?: string;
}

const SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const SLUG_MAX_LEN = 48;
const PREVIEW_MAX_BYTES = 500 * 1024;

export const doctorCommand = new Command("doctor")
  .description("Validate the template locally before publish")
  .option("--path <dir>", "Template directory (defaults to .)")
  .action((opts: DoctorOptions) => {
    const dir = resolve(opts.path ?? ".");
    const checks: Check[] = [];

    const configRaw = readFileIfExists(resolve(dir, "template.config.json"));
    if (!configRaw) {
      checks.push({ name: "template.config.json exists", status: "fail" });
    } else {
      checks.push({ name: "template.config.json exists", status: "pass" });
      try {
        const cfg = JSON.parse(configRaw) as Record<string, unknown>;
        checkConfig(cfg, checks);
      } catch {
        checks.push({ name: "template.config.json parses", status: "fail" });
      }
    }

    const htmlPath = resolve(dir, "index.html");
    const html = readFileIfExists(htmlPath);
    if (!html) {
      checks.push({ name: "index.html exists", status: "fail" });
    } else {
      checks.push({ name: "index.html exists", status: "pass" });
      checkHtml(html, checks);
    }

    const previewPath = resolve(dir, "preview.png");
    if (!existsSync(previewPath)) {
      checks.push({
        name: "preview.png exists",
        status: "fail",
        message: "required 1280×720 PNG hero shot; PREVIEW.md placeholder must be replaced",
      });
    } else {
      const size = statSync(previewPath).size;
      if (size > PREVIEW_MAX_BYTES) {
        checks.push({
          name: "preview.png ≤500KB",
          status: "fail",
          message: `${(size / 1024).toFixed(1)}KB exceeds 500KB cap`,
        });
      } else if (!isPng(previewPath)) {
        checks.push({
          name: "preview.png is a PNG",
          status: "fail",
          message: "file does not start with PNG signature",
        });
      } else {
        checks.push({ name: "preview.png present and valid", status: "pass" });
      }
    }

    checks.push({
      name: "tailwind.config.js exists",
      status: existsSync(resolve(dir, "tailwind.config.js")) ? "pass" : "fail",
    });

    checks.push({
      name: "README.md exists",
      status: existsSync(resolve(dir, "README.md")) ? "pass" : "fail",
    });

    report(checks);
    const failed = checks.filter((c) => c.status === "fail").length;
    process.exit(failed === 0 ? 0 : 1);
  });

function checkConfig(cfg: Record<string, unknown>, out: Check[]): void {
  const slug = cfg.slug;
  if (typeof slug !== "string") {
    out.push({ name: "config.slug is a string", status: "fail" });
  } else if (slug.length > SLUG_MAX_LEN || !SLUG_PATTERN.test(slug)) {
    out.push({
      name: "config.slug is well-formed",
      status: "fail",
      message: `"${slug}" — must be lowercase letters/digits/hyphens, 1-${SLUG_MAX_LEN} chars`,
    });
  } else {
    out.push({ name: "config.slug is well-formed", status: "pass" });
  }

  out.push({
    name: "config.category present",
    status: typeof cfg.category === "string" ? "pass" : "fail",
  });
  out.push({
    name: "config.slot_schema_version is a number",
    status: typeof cfg.slot_schema_version === "number" ? "pass" : "fail",
  });

  const author = cfg.author as Record<string, unknown> | undefined;
  out.push({
    name: "config.author.handle present",
    status: author && typeof author.handle === "string" ? "pass" : "fail",
  });

  if (cfg.license !== "MIT") {
    out.push({
      name: "config.license is MIT",
      status: "fail",
      message: `got ${JSON.stringify(cfg.license)} — FreeWebStore requires MIT`,
    });
  } else {
    out.push({ name: "config.license is MIT", status: "pass" });
  }
}

function checkHtml(html: string, out: Check[]): void {
  if (!html.includes("<!DOCTYPE html>") && !html.includes("<!doctype html>")) {
    out.push({ name: "index.html has a doctype", status: "fail" });
  } else {
    out.push({ name: "index.html has a doctype", status: "pass" });
  }

  const slotCount = (html.match(/data-fws-slot=/g) ?? []).length;
  if (slotCount === 0) {
    out.push({
      name: "index.html has at least one slot marker",
      status: "fail",
      message:
        "no `data-fws-slot` attributes found — without these, the platform AI has to infer structure (less reliable). Add slot markers per slots.md.",
    });
  } else {
    out.push({
      name: `index.html has ${slotCount} slot markers`,
      status: "pass",
    });
  }

  // Disallow external scripts except the Tailwind CDN. Other external
  // scripts are a compliance fail server-side too.
  const externalScripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)]
    .map((m) => m[1])
    .filter((src) => /^https?:\/\//.test(src))
    .filter((src) => !src.startsWith("https://cdn.tailwindcss.com"));
  if (externalScripts.length > 0) {
    out.push({
      name: "no external scripts (except Tailwind CDN)",
      status: "fail",
      message: `disallowed: ${externalScripts.join(", ")}`,
    });
  } else {
    out.push({ name: "no external scripts (except Tailwind CDN)", status: "pass" });
  }
}

function isPng(path: string): boolean {
  const buf = readFileSync(path, { encoding: null }).subarray(0, 8);
  // PNG signature: 89 50 4E 47 0D 0A 1A 0A
  return (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  );
}

function readFileIfExists(path: string): string | null {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

function report(checks: Check[]): void {
  for (const c of checks) {
    const tag = c.status === "pass" ? "✓" : "✗";
    const line = c.message ? `${tag} ${c.name} — ${c.message}` : `${tag} ${c.name}`;
    console.log(line);
  }
  const passed = checks.filter((c) => c.status === "pass").length;
  const failed = checks.length - passed;
  console.log("");
  console.log(
    failed === 0
      ? `All ${checks.length} checks passed.`
      : `${failed} of ${checks.length} checks failed.`,
  );
}
