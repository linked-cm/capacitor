import {
  normalizeReleaseStatus,
  type ReleaseStatus,
} from './releaseStatus.js';

export type ReleaseStatusClientOptions = {
  url: string | (() => string);
  headers?: HeadersInit | (() => HeadersInit);
  timeoutMs?: number;
  fetch?: typeof fetch;
};

/** Deduplicates concurrent loads and falls back to the last valid response. */
export class ReleaseStatusClient {
  private lastValid?: ReleaseStatus;
  private inFlight?: Promise<ReleaseStatus>;
  private readonly options: ReleaseStatusClientOptions;

  constructor(options: ReleaseStatusClientOptions) {
    this.options = options;
  }

  load(): Promise<ReleaseStatus> {
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.request().finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }

  private async request(): Promise<ReleaseStatus> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.options.timeoutMs ?? 8_000
    );
    try {
      const request = this.options.fetch ?? fetch;
      const response = await request(
        typeof this.options.url === 'function'
          ? this.options.url()
          : this.options.url,
        {
          cache: 'no-store',
          headers:
            typeof this.options.headers === 'function'
              ? this.options.headers()
              : this.options.headers,
          signal: controller.signal,
        }
      );
      if (!response.ok) {
        throw new Error(`Status request failed: ${response.status}`);
      }
      this.lastValid = normalizeReleaseStatus(await response.json());
      return this.lastValid;
    } catch (error) {
      if (this.lastValid) return this.lastValid;
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

