---
summary: Fixed manual Capgo OTA downloads so integrity, encryption, and delta metadata returned by the update service reaches the native downloader.
---

# OTA download metadata forwarding

## Outcome

The automatic-update hook now passes all download-specific metadata returned by
`CapacitorUpdater.getLatest()` into `CapacitorUpdater.download()`. Previously it
passed only the bundle URL and version, which caused native installations that
require integrity verification to reject an otherwise valid update with
`Checksum required`.

The forwarded fields are:

- `checksum`, for native bundle integrity verification;
- `sessionKey`, for encrypted bundles; and
- `manifest`, for multi-file delta updates.

URL and version forwarding is unchanged.

## Implementation

`src/hooks/useAutomaticUpdates.ts` owns the manual update sequence. Its new
`getDownloadOptions()` mapping keeps the boundary between the update-service
response and the native download call explicit and independently testable. The
hook uses that mapping only after confirming that `getLatest()` returned a URL.

The helper is exported from the existing hook subpath. This keeps the mapping
available to package consumers that need to construct the same native download
options without duplicating the security-sensitive field list.

## Decisions

The hook forwards the complete set of fields accepted by Capgo's
`DownloadOptions`, instead of fixing only the observed checksum omission. This
avoids equivalent failures when encrypted or delta delivery is enabled.

Optional fields remain optional. Unencrypted full-ZIP updates therefore retain
their existing behavior while checksum-bearing responses preserve their
integrity contract.

No architecture document changed. The update flow and package boundary remain
the same; this corrects metadata propagation inside the existing flow.

## Verification

`tests/automatic-updates.test.mjs` covers complete metadata forwarding and the
absence of optional metadata. The package test suite builds the ESM output
before executing tests, so the assertions exercise the same compiled helper
that consumers import.

Validation completed successfully:

- package test suite: 28 tests passed;
- full package build: passed; and
- whitespace/error check with `git diff --check`: passed.

## Release and operational notes

The change has a patch changeset because it fixes published behavior without
changing the existing hook API. Applications whose currently installed native
bundle contains the broken downloader still require a native store release to
receive this fix; that broken downloader cannot install its own corrective OTA.
Once a native build containing the corrected package is installed, subsequent
checksum-protected OTA updates can use the normal channel flow.

No remaining code or documentation gaps were found in this scope.
