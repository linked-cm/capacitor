import { createNameSpace } from '@_linked/core/utils/NameSpace';
import { loadOntologyFiles } from '@_linked/core/ontology/loadOntologyFiles';

/** The package's ontology data, relative to this module (Turtle, copied into `lib/` by the build). */
export const dataFiles = ['../data/capacitor.ttl'];

/** Reads the package's ontology data (server only). */
export const loadData = () => loadOntologyFiles(import.meta.url, dataFiles);

/**
 * The namespace of this ontology. First-party ontologies live at
 * `https://linked.cm/ont/{slug}/`, the slug being the package's public slug (`capacitor`).
 *
 * Until 1.0 this was `http://lincd.org/ont/lincd-capacitor/`. Data stored under that namespace is
 * invisible to this release until it is rewritten to this one.
 */
export var ns = createNameSpace('https://linked.cm/ont/capacitor/');

export var _self = ns('');

/** @deprecated the namespace before 1.0; stored data is rewritten to {@link ns}. */
export var legacyNs = createNameSpace('http://lincd.org/ont/lincd-capacitor/');

export var LocationUpdateAction = ns('LocationUpdateAction');

//An extra grouping object so all the entities can be accessed from the prefix/name
export const capacitor = {
  LocationUpdateAction,
};

/** @deprecated use {@link capacitor}. */
export const lincdCapacitor = capacitor;
