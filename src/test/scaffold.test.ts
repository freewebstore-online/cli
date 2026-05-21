/**
 * Scaffold output is the designer's first impression — verify it.
 * Tests the pure-function form (no disk IO) so we can assert on the
 * generated text directly.
 */

import { describe, expect, it } from "vitest";
import { scaffoldFiles } from "../lib/scaffold.js";

describe("scaffoldFiles", () => {
  it("produces the expected set of files", () => {
    const files = scaffoldFiles({
      slug: "sofia-bistro",
      category: "restaurant.italian",
      authorHandle: "sofia-dev",
    });
    const paths = files.map((f) => f.path).sort();
    expect(paths).toEqual([
      ".gitignore",
      "PREVIEW.md",
      "README.md",
      "index.html",
      "slots.md",
      "tailwind.config.js",
      "template.config.json",
    ]);
  });

  it("template.config.json is valid JSON with the expected fields", () => {
    const files = scaffoldFiles({
      slug: "sofia-bistro",
      category: "restaurant.italian",
      authorHandle: "sofia-dev",
    });
    const cfg = files.find((f) => f.path === "template.config.json");
    expect(cfg).toBeDefined();
    const parsed = JSON.parse(cfg?.content ?? "{}");
    expect(parsed).toMatchObject({
      v: 1,
      slug: "sofia-bistro",
      category: "restaurant.italian",
      slot_schema_version: 1,
      author: { handle: "sofia-dev" },
      license: "MIT",
    });
  });

  it("index.html includes slot markers", () => {
    const files = scaffoldFiles({
      slug: "x",
      category: "salon.barber",
      authorHandle: "x-dev",
    });
    const html = files.find((f) => f.path === "index.html")?.content ?? "";
    expect(html).toContain('data-fws-slot="business.name"');
    expect(html).toContain('data-fws-slot="business.tagline"');
    expect(html).toContain('data-fws-slot="fws.byline"');
  });

  it("index.html includes Tailwind CDN and no other external scripts", () => {
    const files = scaffoldFiles({
      slug: "x",
      category: "trades.electrician",
      authorHandle: "x-dev",
    });
    const html = files.find((f) => f.path === "index.html")?.content ?? "";
    expect(html).toContain("https://cdn.tailwindcss.com");
    const externals = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/g)]
      .map((m) => m[1])
      .filter((src) => /^https?:\/\//.test(src))
      .filter((src) => !src.startsWith("https://cdn.tailwindcss.com"));
    expect(externals).toEqual([]);
  });

  it("README.md mentions the slug and category", () => {
    const files = scaffoldFiles({
      slug: "thai-place",
      category: "restaurant.thai",
      authorHandle: "j-doe",
    });
    const readme = files.find((f) => f.path === "README.md")?.content ?? "";
    expect(readme).toContain("thai-place");
    expect(readme).toContain("restaurant.thai");
    expect(readme).toContain("@j-doe");
  });

  it("slots.md documents the category-specific schema", () => {
    const files = scaffoldFiles({
      slug: "x",
      category: "restaurant.thai",
      authorHandle: "x-dev",
    });
    const slots = files.find((f) => f.path === "slots.md")?.content ?? "";
    expect(slots).toContain("restaurant.thai");
    expect(slots).toContain("business.name");
    expect(slots).toContain("fws.byline");
  });
});
