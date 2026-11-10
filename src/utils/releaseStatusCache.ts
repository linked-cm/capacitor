import {
  normalizeReleaseStatus,
  type ReleaseStatus,
} from './releaseStatus.js';

export const RELEASE_STATUS_REFRESH_MS = 60_000;

export type ReadReleaseStatus = () => unknown;

/** Keeps serving the last valid snapshot when its injected source fails. */
export class ReleaseStatusCache {
  private snapshot: ReleaseStatus;
  private timer?: ReturnType<typeof setInterval>;
  private readonly readStatus: ReadReleaseStatus;
  private readonly refreshMs: number;
  private readonly log: (message: string, error?: unknown) => void;

  constructor(options: {
    initialStatus: ReleaseStatus;
    readStatus: ReadReleaseStatus;
    refreshMs?: number;
    log?: (message: string, error?: unknown) => void;
  }) {
    this.snapshot = normalizeReleaseStatus(options.initialStatus);
    this.readStatus = options.readStatus;
    this.refreshMs = options.refreshMs ?? RELEASE_STATUS_REFRESH_MS;
    this.log = options.log ?? console.warn;
  }

  load(): ReleaseStatus {
    this.refresh('startup');
    return this.getStatus();
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.refresh('refresh'), this.refreshMs);
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }

  getStatus(): ReleaseStatus {
    return { ...this.snapshot };
  }

  private refresh(reason: 'startup' | 'refresh'): void {
    try {
      this.snapshot = normalizeReleaseStatus(this.readStatus());
    } catch (error) {
      this.log(
        `releaseStatusCache: ${reason} retained last valid snapshot`,
        error
      );
    }
  }
}

type StatusHttpResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): { json(body: ReleaseStatus): unknown };
};

/** Framework-light HTTP adapter; applications still own route registration. */
export function createReleaseStatusHandler(cache: ReleaseStatusCache) {
  return (_request: unknown, response: StatusHttpResponse): void => {
    response.setHeader('Cache-Control', 'no-store');
    response.status(200).json(cache.getStatus());
  };
}

