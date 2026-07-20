import type { AuthUser } from '../common/constants/roles';

declare global {
  namespace Express {
    interface Request {
      /** Populated by AuthGuard once a valid JWT cookie is verified. */
      user?: AuthUser;
      /** Resolved tenant id (from JWT, X-Tenant-Slug header, or subdomain). */
      tenantId?: string;
      /** Lean tenant document, populated when resolved by slug/subdomain. */
      tenant?: Record<string, unknown> | null;
      /** True when a superadmin is impersonating a tenant via X-Act-As-Tenant. */
      actingAsTenant?: boolean;
    }
  }
}

export {};
