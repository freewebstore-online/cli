/**
 * Tests for the apiRequest HTTP client.
 *
 * Uses a local HTTP server to simulate various response types.
 */

import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { apiRequest } from "../lib/api.js";

let server: Server;
let port: number;

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.url === "/json-ok") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ github_login: "testuser", designer_token: "tok" }));
    } else if (req.url === "/json-error") {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "bad request" }));
    } else if (req.url === "/html-200") {
      // Simulates CF Access returning a 200 HTML login page
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html><body>CF Access Login</body></html>");
    } else if (req.url === "/html-302-target") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end("<html><body>Redirected CF Access</body></html>");
    } else if (req.url === "/empty-200") {
      res.writeHead(200);
      res.end("");
    } else {
      res.writeHead(404);
      res.end("not found");
    }
  });
  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const addr = server.address();
      port = typeof addr === "object" && addr ? addr.port : 0;
      resolve();
    });
  });
});

afterAll(() => {
  server.close();
});

describe("apiRequest", () => {
  it("returns parsed JSON body on success", async () => {
    const res = await apiRequest("GET", "/json-ok", undefined, {
      noAuth: true,
      base: `http://localhost:${port}`,
    });
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
    expect((res as any).body.github_login).toBe("testuser");
  });

  it("returns ok:false for JSON error responses", async () => {
    const res = await apiRequest("GET", "/json-error", undefined, {
      noAuth: true,
      base: `http://localhost:${port}`,
    });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
  });

  it("treats HTML 200 as an error (CF Access guard)", async () => {
    const res = await apiRequest("GET", "/html-200", undefined, {
      noAuth: true,
      base: `http://localhost:${port}`,
    });
    expect(res.ok).toBe(false);
    expect(res).toHaveProperty("network_error");
    expect((res as any).network_error).toContain("expected JSON");
    expect((res as any).network_error).toContain("text/html");
  });

  it("handles empty 200 response", async () => {
    const res = await apiRequest("GET", "/empty-200", undefined, {
      noAuth: true,
      base: `http://localhost:${port}`,
    });
    expect(res.ok).toBe(true);
    expect(res.status).toBe(200);
  });

  it("returns network_error for unreachable host", async () => {
    const res = await apiRequest("GET", "/test", undefined, {
      noAuth: true,
      base: "http://localhost:1",
    });
    expect(res.ok).toBe(false);
    expect(res).toHaveProperty("network_error");
  });

  it("uses the base option instead of adminBase", async () => {
    const res = await apiRequest("GET", "/json-ok", undefined, {
      noAuth: true,
      base: `http://localhost:${port}`,
    });
    expect(res.ok).toBe(true);
  });
});
