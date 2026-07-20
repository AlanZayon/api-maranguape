/**
 * AuthGuard role constants parity.
 */
const {
  TENANT_ELEVATED,
  TENANT_STAFF,
  USERS_MANAGERS,
} = require('../../../src/common/constants/roles');

describe('roles constants', () => {
  test('TENANT_ELEVATED includes owner admin superadmin', () => {
    expect([...TENANT_ELEVATED]).toEqual(
      expect.arrayContaining(['owner', 'admin', 'superadmin']),
    );
  });

  test('TENANT_STAFF includes user', () => {
    expect([...TENANT_STAFF]).toContain('user');
  });

  test('USERS_MANAGERS includes owner and superadmin', () => {
    expect([...USERS_MANAGERS]).toEqual(
      expect.arrayContaining(['owner', 'superadmin']),
    );
  });
});
