---
'@linked.cm/capacitor': major
---

Move the ontology to `https://linked.cm/ont/capacitor/` and ship it as Turtle.

- `LocationUpdateAction` moves from `http://lincd.org/ont/lincd-capacitor/LocationUpdateAction`
  to `https://linked.cm/ont/capacitor/LocationUpdateAction`, and is declared
  `rdfs:subClassOf schema:UpdateAction` (its shape extends `UpdateAction`). Stored nodes typed
  with the old class are invisible to this release until the app rewrites the prefix.
- The ontology module is `ontologies/capacitor` (prefix `capacitor`, grouping object
  `capacitor`). `ontologies/lincd-capacitor` and `lincdCapacitor` remain as deprecated aliases,
  as does the old namespace (`legacyNs`).
- `src/data/capacitor.ttl` replaces `lincd-capacitor.json`, which only held a scaffold example
  class; `ontologies/capacitor.register` registers it with the data, so `linked build`'s shape
  check and the store's ontology sync see the class hierarchy.
- Requires `@_linked/core` ^2.37.2 and `@_linked/schema` ^1.6.0.
