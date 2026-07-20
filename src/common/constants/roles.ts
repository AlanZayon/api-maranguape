export const TENANT_ELEVATED = ['owner', 'admin', 'superadmin'] as const;
export const TENANT_STAFF = ['owner', 'admin', 'user'] as const;
export const USERS_MANAGERS = ['owner', 'superadmin'] as const;

export type Role =
  | 'owner'
  | 'admin'
  | 'user'
  | 'readonly'
  | 'superadmin';

export type AuthUser = {
  id: string;
  role: string;
  username: string;
  tenantId: string | null;
};
