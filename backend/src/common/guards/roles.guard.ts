import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Global roles guard. Roles come only from JWT → DB (JwtStrategy),
 * never from request body/query/headers controlled by the client.
 *
 * - No @Roles metadata → allow (still subject to JwtAuthGuard).
 * - Authenticated user without required role → 403 Forbidden.
 * - Missing user.roles (should not happen after JwtAuth) → 403.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    const roles: string[] = Array.isArray(user?.roles) ? user.roles : [];
    const allowed = required.some((role) => roles.includes(role));
    if (!allowed) {
      throw new ForbiddenException('دسترسی مجاز نیست');
    }
    return true;
  }
}
