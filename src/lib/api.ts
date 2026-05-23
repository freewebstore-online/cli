/**
 * HTTP client for the FreeWebStore admin Worker. Wraps fetch with:
 *
 *   - JSON body + headers
 *   - User-Agent identifying the CLI version (so the admin Worker can
 *     reject deprecated clients later if a breaking change ships)
 *   - Installation-token auth from `~/.freewebstore/auth.json`
 *   - Uniform error mapping — never throw raw network errors; return
 *     `{ ok: false, status, body }` so commands can format clean messages
 *
 * Why not just `fetch`?
 *   Every CLI command would need to assemble the base URL + headers +
 *   error-mapping the same way. Extracting once means the commands stay
 *   focused on UX and the contract with admin is testable in one place.
 */

import type { AuthConfig } from "./config.js";
import { adminBase, readAuth } from "./config.js";

const USER_AGENT = "@freewebstore/cli/0.1.0";

export interface ApiOk<T> {
  ok: true;
  status: number;
  body: T;
}

export interface ApiErr {
  ok: false;
  status: number;
  /** Parsed JSON body if the server sent one, otherwise the raw text. */
  body: unknown;
  /** Network-level error message if fetch itself threw. */
  network_error?: string;
}

export type ApiResponse<T> = ApiOk<T> | ApiErr;

export interface RequestOptions {
  /** Override the auth source — used by `fws login` before auth exists. */
  auth?: AuthConfig | null;
  /** Skip auth header entirely (public-read endpoints + /health). */
  noAuth?: boolean;
  /** AbortSignal for command-level timeouts. */
  signal?: AbortSignal;
}

export async function apiRequest<T = unknown>(
  method: string,
  path: string,
  body: unknown | undefined,
  opts: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const url = `${adminBase()}${path}`;
  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT,
    Accept: "application/json",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (!opts.noAuth) {
    const auth = opts.auth !== undefined ? opts.auth : readAuth();
    if (auth) {
      if (auth.v === 2 && auth.designer_token) {
        // New OAuth-based token
        headers.Authorization = `Bearer fws-designer:${auth.designer_token}`;
      } else if (auth.v === 1 && auth.installation_id) {
        // Legacy App-installation token
        headers.Authorization = `Bearer fws-installation:${auth.installation_id}`;
      }
    }
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: opts.signal,
    });
  } catch (e) {
    return {
      ok: false,
      status: 0,
      body: null,
      network_error: e instanceof Error ? e.message : String(e),
    };
  }

  const text = await res.text();
  let parsed: unknown = null;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (res.ok) {
    return { ok: true, status: res.status, body: parsed as T };
  }
  return { ok: false, status: res.status, body: parsed };
}

/** Convenience for the common 2xx-or-die pattern. Throws an Error with
 *  a human-readable message — commands catch this and turn it into a
 *  one-line stderr write + nonzero exit. */
export async function apiCall<T>(
  method: string,
  path: string,
  body?: unknown,
  opts?: RequestOptions,
): Promise<T> {
  const res = await apiRequest<T>(method, path, body, opts);
  if (res.ok) return res.body;
  throw new ApiCallError(res);
}

export class ApiCallError extends Error {
  readonly response: ApiErr;
  constructor(response: ApiErr) {
    super(formatErrorMessage(response));
    this.name = "ApiCallError";
    this.response = response;
  }
}

function formatErrorMessage(res: ApiErr): string {
  if (res.network_error) return `network error: ${res.network_error}`;
  if (typeof res.body === "object" && res.body !== null && "error" in res.body) {
    const e = (res.body as { error?: unknown }).error;
    if (typeof e === "string") return `admin ${res.status}: ${e}`;
  }
  return `admin ${res.status}`;
}
