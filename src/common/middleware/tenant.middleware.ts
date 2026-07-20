import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { Tenant } from '../../modules/tenants/schemas/tenant.schema';
import {
  extractSubdomain,
  isReservedSubdomain,
} from '../utils/tenant.helpers';

const SLUG_TTL_MS = 60_000;
const slugTenantCache = new Map<
  string,
  { tenant: Record<string, unknown>; expiresAt: number }
>();

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly config: ConfigService,
    @InjectModel(Tenant.name) private readonly tenantModel: Model<Tenant>,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    try {
      const token = (
        req as Request & { cookies?: { authToken?: string } }
      ).cookies?.authToken;
      const secret = this.config.get<string>('JWT_SECRET');
      if (token && secret) {
        try {
          const decoded = jwt.verify(token, secret) as { tenantId?: string };
          if (decoded.tenantId) {
            (req as Request & { tenantId?: string }).tenantId = String(
              decoded.tenantId,
            );
            return next();
          }
        } catch {
          // fall through
        }
      }

      const slug = this.resolveSlugFromRequest(req);
      if (!slug || isReservedSubdomain(slug)) {
        return next();
      }

      const tenant = await this.findTenantBySlug(slug);
      if (tenant) {
        (req as Request & { tenant?: unknown; tenantId?: string }).tenant =
          tenant;
        (req as Request & { tenantId?: string }).tenantId = String(tenant._id);
      }
      return next();
    } catch (err) {
      return next(err as Error);
    }
  }

  private resolveSlugFromRequest(req: Request): string | null {
    const rawSlug = req.headers['x-tenant-slug'];
    if (rawSlug) return String(rawSlug).toLowerCase().trim();

    const baseDomain = this.config.get<string>('BASE_DOMAIN') || '';
    const hostHeader =
      (req.headers['x-forwarded-host'] as string) || req.headers.host || '';
    const origin = (req.headers.origin as string) || '';
    let hostname = hostHeader.split(',')[0].trim();
    if (origin) {
      try {
        hostname = new URL(origin).hostname;
      } catch {
        // keep host
      }
    }
    return extractSubdomain(hostname, baseDomain);
  }

  private async findTenantBySlug(slug: string) {
    const cached = slugTenantCache.get(slug);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.tenant as { _id: unknown };
    }

    const tenant = await this.tenantModel
      .findOne({ slug, status: 'active' })
      .lean();

    if (tenant) {
      slugTenantCache.set(slug, {
        tenant: tenant as unknown as Record<string, unknown>,
        expiresAt: Date.now() + SLUG_TTL_MS,
      });
    } else {
      slugTenantCache.delete(slug);
    }
    return tenant;
  }
}
