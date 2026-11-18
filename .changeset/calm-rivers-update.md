---
"@linked.cm/capacitor": minor
---

Add a presentation-free release-control engine that apps can adopt without coupling to a specific product status API.

**New exports**

- `@linked.cm/capacitor/hooks/useMandatoryNativeUpdate` — compare the installed iOS/Android binary to an app-supplied minimum, recheck on foreground/minimum changes, and open the store update flow
- `@linked.cm/capacitor/hooks/useReleaseGate` — inject `loadStatus`, apply maintenance first, enforce the native minimum second, and expose `otaEnabled`
- `@linked.cm/capacitor/utils/releaseStatus` — shared `ReleaseStatus` types plus `normalizeReleaseStatus` / `tryNormalizeReleaseStatus` / `pickReleaseStatus`
- `@linked.cm/capacitor/utils/releaseStatusCache` — injected `ReleaseStatusCache` with last-valid retention and `createReleaseStatusHandler`
- `@linked.cm/capacitor/utils/releaseStatusClient` — deduped `/status` client with last-valid fallback

**`useAutomaticUpdates` options (backward compatible defaults)**

- `enabled` (default `true`) — while `false`, still calls `notifyAppReady()`, but skips channel/health/store/OTA work
- `checkNativeStoreVersion` (default `true`) — disable when a mandatory native gate already owns store updates

**Typical composition**

```ts
const gate = useReleaseGate({
  loadStatus: () => statusClient.load(), // must return normalized ReleaseStatus
  fallbackMinimumVersion: COMPILED_MINIMUM_NATIVE_VERSION,
});

useAutomaticUpdates({
  enabled: gate.otaEnabled,
  checkNativeStoreVersion: false,
});
```

Server caches must call `load()` then `start()`, and `stop()` on dispose. See the package README for full examples.
