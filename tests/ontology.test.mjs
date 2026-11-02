// The capacitor ontology lives at https://linked.cm/ont/capacitor/, ships as Turtle, and the
// package's shapes agree with it under the shape check `linked build` runs.
import assert from 'node:assert/strict';
import test from 'node:test';

import { Prefix } from '@_linked/core/utils/Prefix';
import { definedTermsFromTurtle } from '@_linked/core/ontology/hierarchy';
import { checkShapeHierarchy } from '@_linked/core/shapes/checkShapeHierarchy';
import '@_linked/schema/shapes/index';
import * as capacitor from '../lib/esm/ontologies/capacitor.js';
import { _ontologyResource, loadData } from '../lib/esm/ontologies/capacitor.data.js';
import '../lib/esm/shapes/index.js';
import { packageName } from '../lib/esm/package.js';

const NAMESPACE = 'https://linked.cm/ont/capacitor/';

test('mints terms under https://linked.cm/ont/capacitor/ and exports only terms', () => {
  assert.equal(_ontologyResource.id, NAMESPACE);
  assert.equal(capacitor.LocationUpdateAction.id, `${NAMESPACE}LocationUpdateAction`);
  assert.deepEqual(Object.keys(capacitor), ['LocationUpdateAction']);
  assert.equal(Prefix.getFullURI('capacitor'), NAMESPACE);
});

test('declares LocationUpdateAction, a schema:UpdateAction, in its Turtle data', async () => {
  const defined = await definedTermsFromTurtle(await loadData());
  assert.ok(defined.has(capacitor.LocationUpdateAction.id));
});

test('passes the shape check', async () => {
  const findings = await checkShapeHierarchy({
    dependencies: { [packageName]: ['@_linked/core', '@_linked/schema'] },
  });
  assert.deepEqual(
    findings
      .filter((f) => f.shape?.includes('/shape/capacitor/'))
      .map((f) => `${f.severity} ${f.kind}: ${f.message}`),
    []
  );
});
