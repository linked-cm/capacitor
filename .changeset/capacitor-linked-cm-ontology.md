---
'@linked.cm/capacitor': major
---

The ontology moves to `https://linked.cm/ont/capacitor/` and ships as Turtle with generated
accessor modules.

- **New namespace.** `LocationUpdateAction` moves from
  `http://lincd.org/ont/lincd-capacitor/LocationUpdateAction` to
  `https://linked.cm/ont/capacitor/LocationUpdateAction` (prefix `capacitor`), declared
  `rdfs:subClassOf schema:UpdateAction`. Stored nodes typed with the old class are invisible to
  this release until the app rewrites the namespace.
- **Generated accessor modules.** `src/data/capacitor.ttl` is the only source of terms;
  `linked generate-ontology` writes `ontologies/capacitor` (one named export per term),
  `ontologies/capacitor.data` (`ns`, `dataFiles`, `loadData`, `_ontologyResource`) and
  `ontologies/capacitor.register`. Import the terms as a namespace:
  `import * as capacitor from '@linked.cm/capacitor/ontologies/capacitor'`.
- **Removed:** the aggregated `capacitor` and `lincdCapacitor` objects, `_self` (now
  `_ontologyResource` in `ontologies/capacitor.data`), `legacyNs`, `ns`/`dataFiles`/`loadData`
  from `ontologies/capacitor` (now in `ontologies/capacitor.data`), the module
  `ontologies/lincd-capacitor`, and the JSON-LD data `lincd-capacitor.json`.
- The package is built with `linked build`, which ships `lib/esm/data/capacitor.ttl` and
  `shapes.ttl`. `react` is a declared peer dependency (`^18.2.0 || ^19.0.0`).
- Requires `@_linked/core` ^2.46.0, `@_linked/schema` ^1.9.2, `@_linked/sioc` ^1.6.2,
  `@_linked/react` ^2.1.0, `@_linked/server-utils` ^1.17.0, `@_linked/auth` ^3.21.0 and
  `@_linked/primitives` ^1.10.0; built with `@_linked/cli` ^1.61.0.
