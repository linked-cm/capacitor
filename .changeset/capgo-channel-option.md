---
"@linked.cm/capacitor": patch
---

Add an optional `channel` to `useAutomaticUpdates` so apps can prefer a Capgo Live Update channel other than `production` (for example `dev` for staging OTA). Empty values still default to `production`. Capgo dashboard device overrides continue to win when `allowSet` is false.
