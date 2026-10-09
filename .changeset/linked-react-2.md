---
'@linked.cm/capacitor': minor
---

Depend on `@_linked/react@^2.0.0` (was `^1.1.0`), and on the first releases of its linked dependencies that use it: `@_linked/primitives@^1.8.0` (was `^1.7.0`), `@_linked/schema@^1.5.0` (was `~1.0`) and `@_linked/sioc@^1.4.0` (was `1.x`). `@_linked/core` moves to `^2.27.0`, the core peer range `@_linked/react` 2 requires.

The APIs used from `@_linked/react` — `createLinkedComponentFn` and `cl` — did not change in 2.0.

`@_linked/auth` stays at `^1.2.3`. Auth 1.x still depends on `@_linked/react@^1`, so one copy of react 1 remains, nested under auth, until this package moves to auth 3 — a separate change, since auth 2 and 3 changed stored data and the token transport.

Minor: this is a 0.x package and the change is a dependency move that consumers do not have to act on.
