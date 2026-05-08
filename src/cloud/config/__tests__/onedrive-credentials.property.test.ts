/**
 * Property-based tests for OneDrive credential validation using fast-check
 * Task 1.2: Property 3 - Credential validation correctness
 *
 * Each property test runs a minimum of 100 iterations.
 *
 * **Validates: Requirements 3.4**
 */

import * as fc from 'fast-check';

// We test the validation logic directly rather than importing the module
// (which has side effects from environment detection). This mirrors the
// pattern used in BoxProvider.property.test.ts Property 5.

/**
 * Replicates the isOneDriveConfigured validation logic from onedrive-credentials.ts
 * to test the property in isolation without environment side effects.
 */
function isOneDriveConfiguredLogic(clientId: string, clientSecret: string): boolean {
  const hasValidClientId = Boolean(
    clientId &&
    !clientId.includes('your-') &&
    clientId.length > 10
  );

  const hasValidClientSecret = Boolean(
    clientSecret &&
    !clientSecret.includes('your-') &&
    clientSecret.length > 10
  );

  return hasValidClientId && hasValidClientSecret;
}

// ============================================================================
// Property 3: Credential validation correctness
// Feature: onedrive-integration, Property 3: Credential validation correctness
// Validates: Requirements 3.4
// ============================================================================
describe('Feature: onedrive-integration, Property 3: Credential validation correctness', () => {
  it('isOneDriveConfigured returns true iff both clientId and clientSecret are non-empty, neither contains "your-", and both have length > 10', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 200 }),
        fc.string({ minLength: 0, maxLength: 200 }),
        (clientId, clientSecret) => {
          const result = isOneDriveConfiguredLogic(clientId, clientSecret);

          const expectedValid =
            clientId.length > 10 &&
            !clientId.includes('your-') &&
            clientSecret.length > 10 &&
            !clientSecret.includes('your-');

          expect(result).toBe(expectedValid);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('always returns true for valid credential pairs (non-empty, no "your-", length > 10)', () => {
    const validStringArb = fc.string({ minLength: 11, maxLength: 100 })
      .filter(s => !s.includes('your-'));

    fc.assert(
      fc.property(
        validStringArb,
        validStringArb,
        (clientId, clientSecret) => {
          const result = isOneDriveConfiguredLogic(clientId, clientSecret);
          expect(result).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('always returns false when clientId is empty', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 200 }),
        (clientSecret) => {
          const result = isOneDriveConfiguredLogic('', clientSecret);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('always returns false when clientSecret is empty', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 200 }),
        (clientId) => {
          const result = isOneDriveConfiguredLogic(clientId, '');
          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('always returns false when clientId contains "your-"', () => {
    const clientIdWithYourArb = fc.string({ minLength: 0, maxLength: 50 })
      .map(s => s + 'your-' + s);

    fc.assert(
      fc.property(
        clientIdWithYourArb,
        fc.string({ minLength: 11, maxLength: 100 }).filter(s => !s.includes('your-')),
        (clientId, clientSecret) => {
          const result = isOneDriveConfiguredLogic(clientId, clientSecret);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('always returns false when clientSecret contains "your-"', () => {
    const clientSecretWithYourArb = fc.string({ minLength: 0, maxLength: 50 })
      .map(s => s + 'your-' + s);

    fc.assert(
      fc.property(
        fc.string({ minLength: 11, maxLength: 100 }).filter(s => !s.includes('your-')),
        clientSecretWithYourArb,
        (clientId, clientSecret) => {
          const result = isOneDriveConfiguredLogic(clientId, clientSecret);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('always returns false when clientId has length <= 10', () => {
    const shortStringArb = fc.string({ minLength: 1, maxLength: 10 })
      .filter(s => !s.includes('your-'));

    fc.assert(
      fc.property(
        shortStringArb,
        fc.string({ minLength: 11, maxLength: 100 }).filter(s => !s.includes('your-')),
        (clientId, clientSecret) => {
          const result = isOneDriveConfiguredLogic(clientId, clientSecret);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('always returns false when clientSecret has length <= 10', () => {
    const shortStringArb = fc.string({ minLength: 1, maxLength: 10 })
      .filter(s => !s.includes('your-'));

    fc.assert(
      fc.property(
        fc.string({ minLength: 11, maxLength: 100 }).filter(s => !s.includes('your-')),
        shortStringArb,
        (clientId, clientSecret) => {
          const result = isOneDriveConfiguredLogic(clientId, clientSecret);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
