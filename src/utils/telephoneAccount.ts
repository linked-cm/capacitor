export const AMBIGUOUS_TELEPHONE_IDENTITY = 'AMBIGUOUS_TELEPHONE_IDENTITY';

type AccountWithPerson = {
  id?: string;
  accountOf?: { id?: string } | null;
};

export type TelephoneAccountResolution<T extends AccountWithPerson> =
  | { kind: 'none' }
  | { kind: 'one'; account: T }
  | { kind: 'ambiguous'; accountIds: string[]; personIds: string[] };

/**
 * Resolve query rows without trusting store ordering. Duplicate rows for the
 * same account/person pair are harmless; distinct accounts or Persons fail
 * closed so WhatsApp never authenticates an arbitrary legacy identity.
 */
export function resolveTelephoneAccount<T extends AccountWithPerson>(
  rows: T[] | null | undefined
): TelephoneAccountResolution<T> {
  const unique = new Map<string, T>();

  for (const row of rows || []) {
    if (!row?.accountOf) continue;
    const accountId = row.id || '';
    const personId = row.accountOf.id || '';
    unique.set(`${accountId}\u0000${personId}`, row);
  }

  if (unique.size === 0) return { kind: 'none' };
  if (unique.size === 1) return { kind: 'one', account: [...unique.values()][0] };

  return {
    kind: 'ambiguous',
    accountIds: [...new Set([...unique.values()].map((row) => row.id || ''))]
      .filter(Boolean)
      .sort(),
    personIds: [
      ...new Set([...unique.values()].map((row) => row.accountOf?.id || '')),
    ]
      .filter(Boolean)
      .sort(),
  };
}

export class AmbiguousTelephoneIdentityError extends Error {
  readonly code = AMBIGUOUS_TELEPHONE_IDENTITY;

  constructor(readonly resolution: Extract<TelephoneAccountResolution<any>, { kind: 'ambiguous' }>) {
    super('Multiple accounts use this phone number');
    this.name = 'AmbiguousTelephoneIdentityError';
  }
}

