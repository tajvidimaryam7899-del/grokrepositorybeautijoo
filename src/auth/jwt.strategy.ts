import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  phone?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const isProd = config.get<string>('nodeEnv') === 'production';
    const accessSecret = config.get<string>('jwt.accessSecret');

    if (isProd && (!accessSecret || accessSecret === 'dev-access-secret-change-in-prod-32' || accessSecret.length < 32)) {
      throw new Error(
        'FATAL: JWT_ACCESS_SECRET must be set to a secure string (min 32 characters) in production. Fallback secret is strictly prohibited.',
      );
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: accessSecret || (isProd ? '' : 'dev-access-secret-change-in-prod-32'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: { permission: true },
                },
              },
            },
          },
        },
        profile: true,
        professional: { select: { id: true, status: true, slug: true } },
      },
    });
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException();
    }

    const roles = user.userRoles.map((ur) => ur.role.name);
    const permissions = new Set<string>();
    for (const ur of user.userRoles) {
      if (ur.role?.rolePermissions) {
        for (const rp of ur.role.rolePermissions) {
          if (rp.permission?.code) {
            permissions.add(rp.permission.code);
          }
        }
      }
    }

    return {
      id: user.id,
      phone: user.phone,
      roles,
      permissions: Array.from(permissions),
      profile: user.profile,
      professionalId: user.professional?.id ?? null,
      professionalStatus: user.professional?.status ?? null,
    };
  }
}
