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
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.accessSecret') || 'dev-access-secret-change-in-prod-32',
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        userRoles: { include: { role: true } },
        profile: true,
        professional: { select: { id: true, status: true, slug: true } },
      },
    });
    if (!user || user.status !== 'active') {
      throw new UnauthorizedException();
    }
    return {
      id: user.id,
      phone: user.phone,
      roles: user.userRoles.map((ur) => ur.role.name),
      profile: user.profile,
      professionalId: user.professional?.id ?? null,
      professionalStatus: user.professional?.status ?? null,
    };
  }
}
