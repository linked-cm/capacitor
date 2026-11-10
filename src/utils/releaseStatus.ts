export type MaintenancePlatform =
  | 'all'
  | 'web'
  | 'ios'
  | 'android'
  | 'native';

export type RuntimePlatform = 'web' | 'ios' | 'android';

export type ReleaseStatus = {
  minimumVersion: string;
  maintenanceMode: boolean;
  maintenancePlatform: MaintenancePlatform;
  maintenanceMessage?: string;
};

export const MAINTENANCE_PLATFORMS: readonly MaintenancePlatform[] = [
  'all',
  'web',
  'ios',
  'android',
  'native',
] as const;

const STABLE_VERSION = /^\d+\.\d+\.\d+$/;

export function isStableReleaseVersion(value: unknown): value is string {
  return typeof value === 'string' && STABLE_VERSION.test(value.trim());
}

export function isMaintenancePlatform(
  value: unknown
): value is MaintenancePlatform {
  return (
    typeof value === 'string' &&
    (MAINTENANCE_PLATFORMS as readonly string[]).includes(value)
  );
}

export function assertStableReleaseVersion(value: unknown): string {
  if (typeof value !== 'string' || !STABLE_VERSION.test(value.trim())) {
    throw new Error('minimumVersion must use stable X.Y.Z format');
  }
  return value.trim();
}

export function normalizeReleaseStatus(
  input: unknown,
  options: { defaultMinimumVersion?: string } = {}
): ReleaseStatus {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Release status must be an object');
  }
  const raw = input as Record<string, unknown>;
  // Only an omitted minimum may use the compiled fallback. null/invalid values
  // must fail so callers can retain their last valid snapshot.
  const minimumVersion = assertStableReleaseVersion(
    raw.minimumVersion === undefined
      ? options.defaultMinimumVersion
      : raw.minimumVersion
  );
  const maintenanceMode = raw.maintenanceMode ?? false;
  if (typeof maintenanceMode !== 'boolean') {
    throw new Error('maintenanceMode must be a boolean');
  }
  const maintenancePlatform = raw.maintenancePlatform ?? 'all';
  if (
    !isMaintenancePlatform(maintenancePlatform)
  ) {
    throw new Error(
      `maintenancePlatform must be one of: ${MAINTENANCE_PLATFORMS.join(', ')}`
    );
  }
  let maintenanceMessage: string | undefined;
  if (raw.maintenanceMessage !== undefined) {
    if (typeof raw.maintenanceMessage !== 'string') {
      throw new Error('maintenanceMessage must be a string when provided');
    }
    maintenanceMessage = raw.maintenanceMessage.trim() || undefined;
  }
  return {
    minimumVersion,
    maintenanceMode,
    maintenancePlatform,
    ...(maintenanceMessage ? { maintenanceMessage } : {}),
  };
}

export function tryNormalizeReleaseStatus(
  input: unknown,
  options: { defaultMinimumVersion?: string } = {}
): { ok: true; value: ReleaseStatus } | { ok: false; error: string } {
  try {
    return { ok: true, value: normalizeReleaseStatus(input, options) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function pickReleaseStatus(
  config: {
    minimumVersion?: unknown;
    maintenanceMode?: unknown;
    maintenancePlatform?: unknown;
    maintenanceMessage?: unknown;
  },
  options: { defaultMinimumVersion?: string } = {}
): ReleaseStatus {
  return normalizeReleaseStatus(config, options);
}

export function toStatusResponse(status: ReleaseStatus): ReleaseStatus {
  return normalizeReleaseStatus(status);
}

export function isMaintenanceApplicable(
  status: Pick<ReleaseStatus, 'maintenanceMode' | 'maintenancePlatform'>,
  platform: RuntimePlatform
): boolean {
  if (!status.maintenanceMode) return false;
  if (status.maintenancePlatform === 'all') return true;
  if (status.maintenancePlatform === 'native') return platform !== 'web';
  return status.maintenancePlatform === platform;
}

