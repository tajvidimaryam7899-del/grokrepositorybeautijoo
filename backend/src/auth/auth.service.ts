import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { createHash, randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { SMS_PROVIDER, SmsProvider } from '../sms/sms.provider';
import { RegisterDto, LoginDto, RequestOtpDto, VerifyOtpDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
  ) {}

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async issueTokens(userId: string, phone: string | null) {
    const payload = { sub: userId, phone: phone ?? undefined };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('jwt.accessSecret'),
      expiresIn: this.config.get('jwt.accessTtl') || '15m',
    });
    const refreshToken = await this.jwt.signAsync(
      { ...payload, type: 'refresh' },
      {
        secret: this.config.get('jwt.refreshSecret'),
        expiresIn: this.config.get('jwt.refreshTtl') || '7d',
      },
    );
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
      },
    });
    return { accessToken, refreshToken };
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (existing) throw new ConflictException('این شماره قبلاً ثبت شده است');

    const passwordHash = await argon2.hash(dto.password);
    const customerRole = await this.prisma.role.findUnique({ where: { name: 'customer' } });
    if (!customerRole) throw new BadRequestException('نقش مشتری تعریف نشده — seed را اجرا کنید');

    const user = await this.prisma.user.create({
      data: {
        phone: dto.phone,
        passwordHash,
        phoneVerified: false,
        profile: {
          create: {
            displayName: dto.displayName || dto.phone,
          },
        },
        userRoles: {
          create: { roleId: customerRole.id },
        },
      },
    });

    const tokens = await this.issueTokens(user.id, user.phone);
    return { user: { id: user.id, phone: user.phone }, ...tokens };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
      include: { userRoles: { include: { role: true } } },
    });
    if (!user || !user.passwordHash) throw new UnauthorizedException('اطلاعات ورود نادرست است');
    if (user.status !== 'active') throw new UnauthorizedException('حساب غیرفعال است');

    const ok = await argon2.verify(user.passwordHash, dto.password);
    if (!ok) throw new UnauthorizedException('اطلاعات ورود نادرست است');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.issueTokens(user.id, user.phone);
    return {
      user: {
        id: user.id,
        phone: user.phone,
        roles: user.userRoles.map((r) => r.role.name),
      },
      ...tokens,
    };
  }

  async requestOtp(dto: RequestOtpDto) {
    const purpose = dto.purpose || 'login';
    const code = String(randomInt(100000, 999999));
    const codeHash = await argon2.hash(code);
    const ttl = this.config.get<number>('otpTtlSeconds') || 300;
    const expiresAt = new Date(Date.now() + ttl * 1000);

    const recent = await this.prisma.otpCode.count({
      where: {
        phone: dto.phone,
        purpose,
        createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
      },
    });
    if (recent >= 3) {
      throw new BadRequestException('تعداد درخواست OTP بیش از حد مجاز است. کمی بعد تلاش کنید.');
    }

    await this.prisma.otpCode.create({
      data: {
        phone: dto.phone,
        codeHash,
        purpose,
        expiresAt,
      },
    });

    await this.sms.sendOtp(dto.phone, code);
    return { message: 'کد تأیید ارسال شد', expiresIn: ttl };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const purpose = dto.purpose || 'login';
    const otp = await this.prisma.otpCode.findFirst({
      where: {
        phone: dto.phone,
        purpose,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp) throw new UnauthorizedException('کد نامعتبر یا منقضی شده است');

    const maxAttempts = this.config.get<number>('otpMaxAttempts') || 5;
    if (otp.attempts >= maxAttempts) {
      throw new UnauthorizedException('تعداد تلاش بیش از حد');
    }

    const valid = await argon2.verify(otp.codeHash, dto.code);
    if (!valid) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('کد نادرست است');
    }

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { usedAt: new Date() },
    });

    let user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user) {
      const customerRole = await this.prisma.role.findUniqueOrThrow({ where: { name: 'customer' } });
      user = await this.prisma.user.create({
        data: {
          phone: dto.phone,
          phoneVerified: true,
          profile: { create: { displayName: dto.phone } },
          userRoles: { create: { roleId: customerRole.id } },
        },
        include: { userRoles: { include: { role: true } } },
      });
    } else {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { phoneVerified: true, lastLoginAt: new Date() },
      });
    }

    const tokens = await this.issueTokens(user.id, user.phone);
    return {
      user: {
        id: user.id,
        phone: user.phone,
        roles: user.userRoles.map((r) => r.role.name),
      },
      ...tokens,
    };
  }

  async refresh(refreshToken: string) {
    let payload: { sub: string; type?: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('توکن نامعتبر است');
    }
    if (payload.type !== 'refresh') throw new UnauthorizedException();

    const hash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash: hash } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('توکن منقضی یا باطل شده است');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status !== 'active') throw new UnauthorizedException();

    return this.issueTokens(user.id, user.phone);
  }

  async logout(refreshToken: string) {
    const hash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { message: 'خروج انجام شد' };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        userRoles: { include: { role: true } },
        professional: true,
      },
    });
    if (!user) throw new UnauthorizedException();
    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      status: user.status,
      phoneVerified: user.phoneVerified,
      profile: user.profile,
      roles: user.userRoles.map((r) => r.role.name),
      professional: user.professional
        ? {
            id: user.professional.id,
            slug: user.professional.slug,
            status: user.professional.status,
            title: user.professional.title,
          }
        : null,
    };
  }
}
