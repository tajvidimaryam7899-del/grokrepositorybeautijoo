import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProfessionalStatus, Prisma } from '@prisma/client';

export type CompletionFieldKey =
  | 'title'
  | 'firstName'
  | 'lastName'
  | 'bio'
  | 'avatarOrCover'
  | 'location'
  | 'service'
  | 'workingHours';

export type CompletionResult = {
  percent: number;
  complete: boolean;
  fields: Array<{ key: CompletionFieldKey; label: string; done: boolean }>;
};

const COMPLETION_LABELS: Record<CompletionFieldKey, string> = {
  title: 'title',
  firstName: 'firstName',
  lastName: 'lastName',
  bio: 'bio',
  avatarOrCover: 'avatarOrCover',
  location: 'location',
  service: 'service',
  workingHours: 'workingHours',
};

@Injectable()
export class ProfessionalsService {
  constructor(private readonly prisma: PrismaService) {}

  async search(params: {
    q?: string; city?: string; category?: string; page?: number; limit?: number;
  }) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 50);
    const skip = (page - 1) * limit;
    const where: Prisma.ProfessionalWhereInput = { status: ProfessionalStatus.approved };
    if (params.q) {
      where.OR = [
        { title: { contains: params.q, mode: 'insensitive' } },
        { bio: { contains: params.q, mode: 'insensitive' } },
        { slug: { contains: params.q, mode: 'insensitive' } },
      ];
    }
    if (params.city) {
      where.locations = {
        some: { location: { city: { contains: params.city, mode: 'insensitive' } } },
      };
    }
    if (params.category) {
      where.professionalServices = {
        some: { service: { category: { slug: params.category } }, isActive: true },
      };
    }
    const [items, total] = await Promise.all([
      this.prisma.professional.findMany({
        where, skip, take: limit,
        orderBy: [{ isFeatured: 'desc' }, { ratingAvg: 'desc' }],
        include: {
          user: { select: { profile: { select: { displayName: true, avatarUrl: true } } } },
          locations: { include: { location: true }, where: { isPrimary: true }, take: 1 },
          professionalServices: {
            where: { isActive: true }, take: 5,
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
      include: this.publicInclude(),
    });
    if (!pro || pro.status !== ProfessionalStatus.approved) {
      throw new NotFoundException('Professional not found');
    }
    return pro;
  }

  async getOwn(userId: string) {
    const pro = await this.loadOwnFull(userId);
    return { ...pro, completion: this.computeCompletion(pro) };
  }

  async getOwnPreview(userId: string) {
    return this.loadOwnFull(userId);
  }

  async createForUser(userId: string, data: { slug: string; title: string; bio?: string }) {
    const existing = await this.prisma.professional.findUnique({ where: { userId } });
    if (existing) throw new ConflictException('Already exists');
    const slugTaken = await this.prisma.professional.findUnique({ where: { slug: data.slug } });
    if (slugTaken) throw new ConflictException('Slug taken');
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
        userId, slug: data.slug, title: data.title, bio: data.bio,
        status: ProfessionalStatus.draft,
      },
    });
  }

  async updateOwn(userId: string, data: {
    title?: string; bio?: string; coverImageUrl?: string;
    firstName?: string; lastName?: string; displayName?: string;
    avatarUrl?: string; profileBio?: string;
  }) {
    const pro = await this.prisma.professional.findUnique({ where: { userId } });
    if (!pro) throw new NotFoundException('Not found');

    const proData: Prisma.ProfessionalUpdateInput = {};
    if (data.title !== undefined) {
      const t = data.title.trim();
      if (t.length < 2) throw new BadRequestException('Title too short');
      proData.title = t;
    }
    if (data.bio !== undefined) proData.bio = data.bio.trim() || null;
    if (data.coverImageUrl !== undefined) proData.coverImageUrl = data.coverImageUrl.trim() || null;

    const profileData: Prisma.ProfileUpdateInput = {};
    if (data.firstName !== undefined) profileData.firstName = data.firstName.trim() || null;
    if (data.lastName !== undefined) profileData.lastName = data.lastName.trim() || null;
    if (data.displayName !== undefined) {
      const d = data.displayName.trim();
      if (d) profileData.displayName = d;
    }
    if (data.avatarUrl !== undefined) profileData.avatarUrl = data.avatarUrl.trim() || null;
    if (data.profileBio !== undefined) profileData.bio = data.profileBio.trim() || null;

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(proData).length > 0) {
        await tx.professional.update({ where: { id: pro.id }, data: proData });
      }
      if (Object.keys(profileData).length > 0) {
        await tx.profile.update({ where: { userId }, data: profileData });
      }
    });
    return this.getOwn(userId);
  }

  async publish(userId: string) {
    const pro = await this.loadOwnFull(userId);
    const completion = this.computeCompletion(pro);
    if (!completion.complete) {
      throw new BadRequestException({
        message: 'Profile incomplete',
        completion,
      });
    }
    if (pro.status === ProfessionalStatus.suspended) {
      throw new ForbiddenException('Suspended');
    }
    // Use verifiedAt as publish timestamp (compatible with current schema without publishedAt)
    const updated = await this.prisma.professional.update({
      where: { id: pro.id },
      data: {
        status: ProfessionalStatus.approved,
        verifiedAt: pro.verifiedAt ?? new Date(),
      },
      include: this.publicInclude(),
    });
    return { ...updated, completion, publishedAt: updated.verifiedAt };
  }

  async unpublish(userId: string) {
    const pro = await this.prisma.professional.findUnique({ where: { userId } });
    if (!pro) throw new NotFoundException('Not found');
    if (pro.status !== ProfessionalStatus.approved) {
      throw new BadRequestException('Not published');
    }
    await this.prisma.professional.update({
      where: { id: pro.id },
      data: { status: ProfessionalStatus.draft },
    });
    return this.getOwn(userId);
  }

  async requireOwnProfessional(userId: string) {
    const pro = await this.prisma.professional.findUnique({ where: { userId } });
    if (!pro) throw new ForbiddenException('Not found');
    return pro;
  }

  computeCompletion(pro: {
    title?: string | null; bio?: string | null; coverImageUrl?: string | null;
    user?: { profile?: {
      firstName?: string | null; lastName?: string | null;
      avatarUrl?: string | null; bio?: string | null;
    } | null } | null;
    locations?: unknown[];
    professionalServices?: Array<{ isActive?: boolean }>;
    workingHours?: Array<{ isActive?: boolean }>;
  }): CompletionResult {
    const profile = pro.user?.profile;
    const hasTitle = !!(pro.title && pro.title.trim().length >= 2);
    const hasFirst = !!(profile?.firstName && profile.firstName.trim().length >= 1);
    const hasLast = !!(profile?.lastName && profile.lastName.trim().length >= 1);
    const bioText = (pro.bio || profile?.bio || '').trim();
    const hasBio = bioText.length >= 10;
    const hasImage = !!(
      (pro.coverImageUrl && pro.coverImageUrl.trim()) ||
      (profile?.avatarUrl && profile.avatarUrl.trim())
    );
    const hasLocation = Array.isArray(pro.locations) && pro.locations.length > 0;
    const hasService =
      Array.isArray(pro.professionalServices) &&
      pro.professionalServices.some((s) => s.isActive !== false);
    const hasHours =
      Array.isArray(pro.workingHours) &&
      pro.workingHours.some((h) => h.isActive !== false);

    const fields: CompletionResult['fields'] = [
      { key: 'title', label: COMPLETION_LABELS.title, done: hasTitle },
      { key: 'firstName', label: COMPLETION_LABELS.firstName, done: hasFirst },
      { key: 'lastName', label: COMPLETION_LABELS.lastName, done: hasLast },
      { key: 'bio', label: COMPLETION_LABELS.bio, done: hasBio },
      { key: 'avatarOrCover', label: COMPLETION_LABELS.avatarOrCover, done: hasImage },
      { key: 'location', label: COMPLETION_LABELS.location, done: hasLocation },
      { key: 'service', label: COMPLETION_LABELS.service, done: hasService },
      { key: 'workingHours', label: COMPLETION_LABELS.workingHours, done: hasHours },
    ];
    const doneCount = fields.filter((f) => f.done).length;
    const percent = Math.round((doneCount / fields.length) * 100);
    return { percent, complete: percent === 100, fields };
  }

  private publicInclude() {
    return {
      user: {
        select: {
          profile: {
            select: {
              displayName: true, firstName: true, lastName: true, avatarUrl: true, bio: true,
            },
          },
        },
      },
      locations: { include: { location: true } },
      professionalServices: {
        where: { isActive: true },
        include: { service: { include: { category: true } } },
      },
      workingHours: { where: { isActive: true }, include: { breaks: true } },
      reviews: {
        where: { isPublished: true }, take: 10, orderBy: { createdAt: 'desc' as const },
        include: { customer: { select: { profile: { select: { displayName: true } } } } },
      },
    };
  }

  private async loadOwnFull(userId: string) {
    const pro = await this.prisma.professional.findUnique({
      where: { userId },
      include: {
        user: { select: { phone: true, profile: true } },
        locations: { include: { location: true } },
        professionalServices: { include: { service: { include: { category: true } } } },
        workingHours: { include: { breaks: true } },
      },
    });
    if (!pro) throw new NotFoundException('Not found');
    return pro;
  }
}
