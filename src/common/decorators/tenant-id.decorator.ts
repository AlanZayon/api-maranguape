import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | null => {
    const req = ctx.switchToHttp().getRequest<{
      tenantId?: string;
      user?: { tenantId?: string | null };
    }>();
    return req.tenantId || req.user?.tenantId || null;
  },
);
