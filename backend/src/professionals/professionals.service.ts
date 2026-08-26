import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProfessionalStatus, Prisma } from '@prisma/client';

@Injectable()
export class ProfessionalsService {
  constructor(private readonly prisma: PrismaService) {}

  async search(params: {
    q?: string;
    city?: string;
    category?: string;
    page?: number;
    limit?: number;
  }) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 50);
    const skip = (page - 1) * limit;
    const where: Prisma.ProfessionalWhereInput = {
      status: ProfessionalStatus.approved,
    };
    if (params.q) {
      where.OR = [
        { title: { contains: params.q, mode: 'insensitive' } },
        { bio: { contains: params.q, mode: 'insensitive' } },
        { slug: { contains: params.q, mode: 'insensitive' } },
      ];
    }
    if (params.city) {
      where.locations = { some: { location: { city: { contains: params.city, mode: 'insensitive' } } } };
    }
    if (params.category) {
      where.professionalServices = {
        some: { service: { category: { slug: params.category } }, isActive: true },
      };
    }
    const [items, total] = await Promise.all([
      this.prisma.professional.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ isFeatured: 'desc' }, { ratingAvg: 'desc' }],
        include: {
          user: { select: { profile: { select: { displayName: true, avatarUrl: true } } } },
          locations: { include: { location: true }, where: { isPrimary: true }, take: 1 },
          professionalServices: {
            where: { isActive: true },
            take: 5,
            include: { service: { select: { name: true, slug: true } } },
          },
        },
      }),
      this.prisma.professional.count({ where }),
    ]);
    return { items, meta: { page, limit, total } };
  }

  async findBySlug(slug: string) {
    const pro = await this.prisma.professional.findUnique({
      where: { slug },
      include: {
        user: { select: { profile: { select: { displayName: true, avatarUrl: true, bio: true } } } },
        locations: { include: { location: true } },
        professionalServices: {
          where: { isActive: true },
          include: { service: { include: { category: true } } },
        },
        workingHours: { where: { isActive: true }, include: { breaks: true } },
        reviews: {
          where: { isPublished: true },
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { customer: { select: { profile: { select: { displayName: true } } } } },
        },
      },
    });
    if (!pro || pro.status !== ProfessionalStatus.approved) {
      throw new NotFoundException('زیباگر یافت نشد');
    }
    return pro;
  }

  async createForUser(userId: string, data: { slug: string; title: string; bio?: string }) {
    const existing = await this.prisma.professional.findUnique({ where: { userId } });
    if (existing) throw new ConflictException('پروفایل زیباگر قبلاً ایجاد شده است');

    const slugTaken = await this.prisma.professional.findUnique({ where: { slug: data.slug } });
    if (slugTaken) throw new ConflictException('این اسلاگ قبلاً استفاده شده است');

    const proRole = await this.prisma.role.findUnique({ where: { name: 'professional' } });
    if (proRole) {
      await this.prisma.userRole.upsert({
        where: { userId_roleId: { userId, roleId: proRole.id } },
        update: {},
        create: { userId, roleId: proRole.id },
      });
    }

    return this.prisma.professional.create({
      data: {
        userId,
        slug: data.slug,
        title: data.title,
        bio: data.bio,
        status: ProfessionalStatus.pending_review,
      },
    });
  }

  async updateOwn(userId: string, data: { title?: string; bio?: string; coverImageUrl?: string }) {
    const pro = await this.prisma.professional.findUnique({ where: { userId } });
    if (!pro) throw new NotFoundException();
    return this.prisma.professional.update({
      where: { id: pro.id },
      data: {
        title: data.title,
        bio: data.bio,
        coverImageUrl: data.coverImageUrl,
      },
    });
  }

  async requireOwnProfessional(userId: string) {
    const pro = await this.prisma.professional.findUnique({ where: { userId } });
    if (!pro) throw new ForbiddenException('پروفایل زیباگر یافت نشد');
    return pro;
  }
}
