---
'@linked.cm/capacitor': patch
---

Fix manual Capgo OTA downloads by forwarding the checksum returned by `getLatest()` to the native downloader. Encrypted and delta updates now also receive the returned session key and manifest.
