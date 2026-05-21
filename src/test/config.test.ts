/**
 * Auth config round-trips and admin-base resolution.
 *
 * Uses $FREEWEBSTORE_CONFIG_DIR to point at a tmp dir per test so the
 * real ~/.freewebstore is never touched.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  type AuthConfig,
  adminBase,
  authPath,
  clearAuth,
  configDir,
  DEFAULT_ADMIN_BASE,
  readAuth,
  writeAuth,
} from "../lib/config.js";

let tmp: string;
let originalEnv: string | undefined;
let originalBase: string | undefined;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "fws-cli-test-"));
  originalEnv = process.env.FREEWEBSTORE_CONFIG_DIR;
  originalBase = process.env.FREEWEBSTORE_ADMIN_BASE;
  process.env.FREEWEBSTORE_CONFIG_DIR = tmp;
  delete process.env.FREEWEBSTORE_ADMIN_BASE;
});

afterEach(() => {
  if (originalEnv === undefined) delete process.env.FREEWEBSTORE_CONFIG_DIR;
  else process.env.FREEWEBSTORE_CONFIG_DIR = originalEnv;
  if (originalBase === undefined) delete process.env.FREEWEBSTORE_ADMIN_BASE;
  else process.env.FREEWEBSTORE_ADMIN_BASE = originalBase;
  rmSync(tmp, { recursive: true, force: true });
});

function sampleAuth(): AuthConfig {
  return {
    v: 1,
    installation_id: "123456",
    github_login: "sofia-dev",
    admin_base: "https://admin.freewebstore.online",
    saved_at: "2026-05-21T11:00:00.000Z",
  };
}

describe("auth config", () => {
  it("configDir honors FREEWEBSTORE_CONFIG_DIR", () => {
    expect(configDir()).toBe(tmp);
  });

  it("authPath is under configDir", () => {
    expect(authPath()).toBe(join(tmp, "auth.json"));
  });

  it("readAuth returns null when no file exists", () => {
    expect(readAuth()).toBeNull();
  });

  it("writeAuth + readAuth round-trip", () => {
    writeAuth(sampleAuth());
    const got = readAuth();
    expect(got).toEqual(sampleAuth());
  });

  it("readAuth returns null for an unknown version", () => {
    writeAuth({ ...sampleAuth(), v: 99 as unknown as 1 });
    expect(readAuth()).toBeNull();
  });

  it("readAuth returns null for corrupt JSON", () => {
    writeAuth(sampleAuth());
    // Corrupt the file
    const fs = require("node:fs") as typeof import("node:fs");
    fs.writeFileSync(authPath(), "{not-json", "utf8");
    expect(readAuth()).toBeNull();
  });

  it("clearAuth removes the file and returns true", () => {
    writeAuth(sampleAuth());
    expect(clearAuth()).toBe(true);
    expect(readAuth()).toBeNull();
  });

  it("clearAuth returns false when no file exists", () => {
    expect(clearAuth()).toBe(false);
  });
});

describe("adminBase resolution", () => {
  it("falls back to the production default when no env and no auth", () => {
    expect(adminBase()).toBe(DEFAULT_ADMIN_BASE);
  });

  it("uses the saved auth's admin_base if set and no env override", () => {
    writeAuth({ ...sampleAuth(), admin_base: "https://admin-staging.freewebstore.online" });
    expect(adminBase()).toBe("https://admin-staging.freewebstore.online");
  });

  it("FREEWEBSTORE_ADMIN_BASE env overrides saved auth", () => {
    writeAuth(sampleAuth());
    process.env.FREEWEBSTORE_ADMIN_BASE = "http://localhost:8787";
    expect(adminBase()).toBe("http://localhost:8787");
  });
});
