import { APIRequestContext, APIResponse, expect, request } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env';
import type { AuthResult, Envelope } from './types';

const NETWORK_RETRIES = 3;

export interface UploadFile { field: string; filePath: string; mimeType?: string }

/**
 * Thin wrapper over Playwright's APIRequestContext.
 *
 * - `get/post/patch/upload` return the raw APIResponse (use for negative/status assertions).
 * - `getData/postData/patchData/list` assert the expected status and return the unwrapped `data`.
 */
export class ApiClient {
  private constructor(readonly ctx: APIRequestContext, readonly token?: string) {}

  /** A client authenticated with `token`, or anonymous when omitted. */
  static async create(token?: string): Promise<ApiClient> {
    const ctx = await request.newContext({
      baseURL: `${env.apiBase}/`,
      extraHTTPHeaders: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
    return new ApiClient(ctx, token);
  }

  /** Logs in through the API and returns the token + user (login token generation). */
  static async login(email: string, password: string): Promise<{ status: number; body: string; result?: AuthResult }> {
    const anonymous = await ApiClient.create();
    try {
      const response = await anonymous.post('auth/login', { email, password });
      // Read the body before the context is disposed (a disposed response cannot be read).
      const body = await response.text();
      const result = response.ok() ? (JSON.parse(body) as Envelope<AuthResult>).data : undefined;
      return { status: response.status(), body, result };
    } finally {
      await anonymous.dispose();
    }
  }

  dispose(): Promise<void> {
    return this.ctx.dispose();
  }

  // Node closes idle keep-alive sockets after 5s; Playwright retries only ECONNRESET with maxRetries,
  // so a pooled connection that went stale between two calls is transparently replaced.
  // Paths are relative (no leading slash) so they resolve under `<api>/api/`.
  private url(p: string): string {
    return p.replace(/^\//, '');
  }

  get(p: string, query?: Record<string, string | number>): Promise<APIResponse> {
    return this.ctx.get(this.url(p), { params: query, maxRetries: NETWORK_RETRIES });
  }
  post(p: string, data?: unknown): Promise<APIResponse> {
    return this.ctx.post(this.url(p), { data: data as object, maxRetries: NETWORK_RETRIES });
  }
  patch(p: string, data?: unknown): Promise<APIResponse> {
    return this.ctx.patch(this.url(p), { data: data as object, maxRetries: NETWORK_RETRIES });
  }
  upload(p: string, file?: UploadFile): Promise<APIResponse> {
    return this.ctx.post(this.url(p), {
      maxRetries: NETWORK_RETRIES,
      multipart: file
        ? {
            [file.field]: {
              name: path.basename(file.filePath),
              mimeType: file.mimeType ?? 'text/plain',
              buffer: fs.readFileSync(file.filePath)
            }
          }
        : {}
    });
  }

  async getData<T>(p: string, query?: Record<string, string | number>): Promise<T> {
    return unwrap<T>(await this.get(p, query), 200);
  }
  async list<T>(p: string, query: Record<string, string | number> = { limit: 100 }): Promise<T[]> {
    return unwrap<T[]>(await this.get(p, query), 200);
  }
  async postData<T>(p: string, data?: unknown, status = 201): Promise<T> {
    return unwrap<T>(await this.post(p, data), status);
  }
  async patchData<T>(p: string, data: unknown, status = 200): Promise<T> {
    return unwrap<T>(await this.patch(p, data), status);
  }
}

/** Asserts the HTTP status (with the body in the failure message) and returns `body.data`. */
export async function unwrap<T>(response: APIResponse, expectedStatus: number): Promise<T> {
  const text = await response.text();
  expect(response.status(), `${response.url()} -> ${text}`).toBe(expectedStatus);
  return (JSON.parse(text) as Envelope<T>).data;
}

/** Parses a failed response body ({ success:false, message }). */
export async function errorBody(response: APIResponse): Promise<Envelope<unknown>> {
  return (await response.json()) as Envelope<unknown>;
}
