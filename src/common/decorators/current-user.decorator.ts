import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthUser } from '../constants/roles';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthUser }>();
    return req.user;
  },
);
