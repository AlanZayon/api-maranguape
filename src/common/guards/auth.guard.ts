import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as jwt from 'jsonwebtoken';
import { Request } from 'express';
import { AppError } from '../errors/app-error';
import { AuthUser } from '../constants/roles';
import { Tenant } from '../../modules/tenants/schemas/tenant.schema';

type JwtPayload = {
  id: string;
  role: string;
  username: string;
  tenantId?: string | null;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    @InjectModel(Tenant.name) private readonly tenantModel: Model<Tenant>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<
      Request & {
        user?: AuthUser;
        tenantId?: string;
        tenant?: unknown;
        actingAsTenant?: boolean;
        cookies?: { authToken?: string };
        query: { actAs?: string };
      }
    >();

    const token = req.cookies?.authToken;
    if (!token) {
      throw new AppError('Não autenticado', 401, 'UNAUTHORIZED');
    }

    try {
      const secret = this.config.get<string>('JWT_SECRET') || '';
      const decoded = jwt.verify(token, secret) as JwtPayload;
      req.user = {
        id: String(decoded.id),
        role: decoded.role,
        username: decoded.username,
        tenantId: decoded.tenantId || null,
      };

      const isSuperadmin = decoded.role === 'superadmin';
      if (!isSuperadmin && !decoded.tenantId) {
        throw new AppError(
          'Usuário sem tenant associado',
          403,
          'TENANT_REQUIRED',
        );
      }

      if (decoded.tenantId && !req.tenantId) {
        req.tenantId = String(decoded.tenantId);
      }

      if (isSuperadmin) {
        const actAs =
          (req.headers['x-act-as-tenant'] as string | undefined) ||
          req.query.actAs ||
          null;
        if (actAs) {
          const slug = String(actAs).toLowerCase().trim();
          const tenant = await this.tenantModel
            .findOne({ slug, status: 'active' })
            .lean();
          if (!tenant) {
            throw new AppError(
              'Tenant para impersonação não encontrado',
              404,
              'ACT_AS_TENANT_NOT_FOUND',
            );
          }
          req.tenant = tenant;
          req.tenantId = String(tenant._id);
          req.actingAsTenant = true;
        }
      }

      return true;
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError('Sessão inválida ou expirada', 401, 'UNAUTHORIZED');
    }
  }
}
