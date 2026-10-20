import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AMBIGUOUS_TELEPHONE_IDENTITY,
  AmbiguousTelephoneIdentityError,
  resolveTelephoneAccount,
} from '../lib/esm/utils/telephoneAccount.js';

const account = (id, personId) => ({ id, accountOf: { id: personId } });

test('normalized unique telephone selects exactly one Person', () => {
  const selected = account('urn:account:1', 'urn:person:1');
  assert.deepEqual(resolveTelephoneAccount([selected]), {
    kind: 'one',
    account: selected,
  });
});

test('telephone absent selects the existing new-account path', () => {
  assert.deepEqual(resolveTelephoneAccount([]), { kind: 'none' });
  assert.deepEqual(resolveTelephoneAccount(null), { kind: 'none' });
});

test('telephone ambiguous refuses to select an arbitrary Person', () => {
  const resolution = resolveTelephoneAccount([
    account('urn:account:b', 'urn:person:b'),
    account('urn:account:a', 'urn:person:a'),
  ]);
  assert.deepEqual(resolution, {
    kind: 'ambiguous',
    accountIds: ['urn:account:a', 'urn:account:b'],
    personIds: ['urn:person:a', 'urn:person:b'],
  });
  assert.equal('account' in resolution, false);
  const error = new AmbiguousTelephoneIdentityError(resolution);
  assert.equal(error.code, AMBIGUOUS_TELEPHONE_IDENTITY);
});

test('legacy placeholder telephone fails closed for multiple Persons', () => {
  const resolution = resolveTelephoneAccount([
    account('urn:account:placeholder-a', 'urn:person:placeholder-a'),
    account('urn:account:placeholder-b', 'urn:person:placeholder-b'),
  ]);
  assert.equal(resolution.kind, 'ambiguous');
  assert.equal('account' in resolution, false);
});

test('duplicate query rows for one account and Person deduplicate', () => {
  const selected = account('urn:account:1', 'urn:person:1');
  const resolution = resolveTelephoneAccount([
    selected,
    account('urn:account:1', 'urn:person:1'),
  ]);
  assert.equal(resolution.kind, 'one');
  assert.equal(resolution.account.id, 'urn:account:1');
});

test('one account linked to distinct Persons is ambiguous', () => {
  const resolution = resolveTelephoneAccount([
    account('urn:account:1', 'urn:person:1'),
    account('urn:account:1', 'urn:person:2'),
  ]);
  assert.equal(resolution.kind, 'ambiguous');
  assert.deepEqual(resolution.personIds, ['urn:person:1', 'urn:person:2']);
});

test('combined WebID and telephone matches expose a legacy duplicate', () => {
  const resolution = resolveTelephoneAccount([
    account('urn:account:whatsapp', 'urn:person:whatsapp'),
    account('urn:account:email', 'urn:person:email'),
  ]);

  assert.deepEqual(resolution, {
    kind: 'ambiguous',
    accountIds: ['urn:account:email', 'urn:account:whatsapp'],
    personIds: ['urn:person:email', 'urn:person:whatsapp'],
  });
});
