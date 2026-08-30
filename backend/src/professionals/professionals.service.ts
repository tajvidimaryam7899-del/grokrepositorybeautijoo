import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, ProfessionalStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const COMPLETION_LABELS: Record<string, string> = {
  title: '\u0639\u0646\u0648\u0627\u0646 \u062d\u0631\u0641\u0647\u200c\u0627\u06cc',
  firstName: '\u0646\u0627\u0645',
  lastName: '\u0646\u0627\u0645 \u062e\u0627\u0646\u0648\u0627\u062f\u06af\u06cc',
  bio: '\u0645\u0639\u0631\u0641\u06cc',
  avatarOrCover: '\u062a\u0635\u0648\u06cc\u0631 \u067e\u0631\u0648\u0641\u0627\u06cc\u0644',
  location: '\u0645\u0648\u0642\u0639\u06cc\u062a',
  service: '\u062a\u062e\u0635\u0635',
  workingHours: '\u0633\u0627\u0639\u0627\u062a \u06a9\u0627\u0631\u06cc',
};

@Injectable()
export class ProfessionalsService {
  constructor(private readonly prisma: PrismaService) {}

  requireOwnProfessional(userId: string) {
    return this.prisma.professional.findUnique({ where: { userId } }).then((pro) => {
      if (!pro) throw new NotFoundException('\u067e\u0631\u0648\u0641\u0627\u06cc\u0644 \u0632\u06cc\u0628\u0627\u06af\u0631 \u06cc\u0627\u0641\u062a \u0646\u0634\u062f');
      return pro;
    });
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
    if (existing) throw new ConflictException('\u067e\u0631\u0648\u0641\u0627\u06cc\u0644 \u0632\u06cc\u0628\u0627\u06af\u0631 \u0642\u0628\u0644\u0627\u064b \u0627\u06cc\u062c\u0627\u062f \u0634\u062f\u0647 \u0627\u0633\u062a');
    const slugTaken = await this.prisma.professional.findUnique({ where: { slug: data.slug } });
    if (slugTaken) throw new ConflictException('\u0627\u06cc\u0646 \u0627\u0633\u0644\u0627\u06af \u0642\u0628\u0644\u0627\u064b \u0627\u0633\u062a\u0641\u0627\u062f\u0647 \u0634\u062f\u0647 \u0627\u0633\u062a');
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
    title?: string; bio?: string; coverImageUrl?: string; logoUrl?: string;
    firstName?: string; lastName?: string; displayName?: string;
    avatarUrl?: string; profileBio?: string;
  }) {
    const pro = await this.prisma.professional.findUnique({ where: { userId } });
    if (!pro) throw new NotFoundException('\u067e\u0631\u0648\u0641\u0627\u06cc\u0644 \u0632\u06cc\u0628\u0627\u06af\u0631 \u06cc\u0627\u0641\u062a \u0646\u0634\u062f');

    const proData: Prisma.ProfessionalUpdateInput = {};
    if (data.title !== undefined) {
      const t = data.title.trim();
      if (t.length < 2) throw new BadRequestException('\u0639\u0646\u0648\u0627\u0646 \u0628\u0627\u06cc\u062f \u062d\u062f\u0627\u0642\u0644 \u06f2 \u06a9\u0627\u0631\u0627\u06a9\u062a\u0631 \u0628\u0627\u0634\u062f');
      proData.title = t;
    }
    if (data.bio !== undefined) proData.bio = data.bio.trim() || null;
    if (data.coverImageUrl !== undefined) proData.coverImageUrl = data.coverImageUrl.trim() || null;
    if (data.logoUrl !== undefined) proData.logoUrl = data.logoUrl.trim() || null;

    const profileData: Prisma.ProfileUpdateInput = {};
    if (data.firstName !== undefined) profileData.firstName = data.firstName.trim() || null;
    if (data.lastName !== undefined) profileData.lastName = data.lastName.trim() || null;
    if (data.displayName !== undefined) profileData.displayName = data.displayName.trim();
    if (data.avatarUrl !== undefined) profileData.avatarUrl = data.avatarUrl.trim() || null;
    if (data.profileBio !== undefined) profileData.bio = data.profileBio.trim() || null;

    if (Object.keys(proData).length) {
      await this.prisma.professional.update({ where: { id: pro.id }, data: proData });
    }
    if (Object.keys(profileData).length) {
      await this.prisma.profile.update({ where: { userId }, data: profileData });
    }
    return this.getOwn(userId);
  }

  async publish(userId: string) {
    const pro = await this.loadOwnFull(userId);
    const completion = this.computeCompletion(pro);
    if (!completion.complete) {
      throw new BadRequestException({
        message: '\u067e\u0631\u0648\u0641\u0627\u06cc\u0644 \u0646\u0627\u0642\u0635 \u0627\u0633\u062a',
        completion,
      });
    }
    const updated = await this.prisma.professional.update({
      where: { id: pro.id },
      data: {
        status: ProfessionalStatus.approved,
        publishedAt: new Date(),
      },
    });
    return { ...updated, completion };
  }

  async unpublish(userId: string) {
    const pro = await this.prisma.professional.findUnique({ where: { userId } });
    if (!pro) throw new NotFoundException();
    await this.prisma.professional.update({
      where: { id: pro.id },
      data: { status: ProfessionalStatus.draft, publishedAt: null },
    });
    return this.getOwn(userId);
  }

  computeCompletion(pro: {
    title?: string | null; bio?: string | null; coverImageUrl?: string | null;
    user?: { profile?: {
      firstName?: string | null; lastName?: string | null;
      avatarUrl?: string | null; bio?: string | null;
    } | null } | null;
    locations?: unknown[];
    professionalServices?: { isActive?: boolean | null }[];
    workingHours?: { isActive?: boolean | null }[];
  }) {
    const profile = pro.user?.profile;
    const hasTitle = !!(pro.title && pro.title.trim().length >= 2);
    const hasFirst = !!(profile?.firstName && profile.firstName.trim());
    const hasLast = !!(profile?.lastName && profile.lastName.trim());
    const hasBio = !!(pro.bio && pro.bio.trim()) || !!(profile?.bio && profile.bio.trim());
    const hasImage = !!(
      (pro.coverImageUrl && pro.coverImageUrl.trim()) ||
      ((pro as { logoUrl?: string | null }).logoUrl && String((pro as { logoUrl?: string | null }).logoUrl).trim()) ||
      (profile?.avatarUrl && profile.avatarUrl.trim())
    );
    const hasLocation = Array.isArray(pro.locations) && pro.locations.length > 0;
    const hasService =
      Array.isArray(pro.professionalServices) &&
      pro.professionalServices.some((s) => s.isActive !== false);
    const hasHours =
      Array.isArray(pro.workingHours) &&
      pro.workingHours.some((h) => h.isActive !== false);

    const fields = [
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
    if (!pro) throw new NotFoundException('\u067e\u0631\u0648\u0641\u0627\u06cc\u0644 \u0632\u06cc\u0628\u0627\u06af\u0631 \u06cc\u0627\u0641\u062a \u0646\u0634\u062f');
    return pro;
  }

  async findPublicBySlug(slug: string) {
    const pro = await this.prisma.professional.findFirst({
      where: { slug, status: ProfessionalStatus.approved, publishedAt: { not: null } },
      include: this.publicInclude(),
    });
    if (!pro) throw new NotFoundException();
    return pro;
  }

  async searchPublic(params: { q?: string; city?: string; page?: number; limit?: number }) {
    const page = params.page || 1;
    const limit = Math.min(params.limit || 20, 50);
    const where: Prisma.ProfessionalWhereInput = {
      status: ProfessionalStatus.approved,
      publishedAt: { not: null },
      ...(params.q
        ? {
            OR: [
              { title: { contains: params.q, mode: 'insensitive' } },
              { bio: { contains: params.q, mode: 'insensitive' } },
              { slug: { contains: params.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(params.city
        ? { locations: { some: { location: { city: { contains: params.city, mode: 'insensitive' } } } } }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.professional.findMany({
        where,
        include: {
          user: { select: { profile: { select: { displayName: true, avatarUrl: true } } } },
          locations: { include: { location: true }, take: 1 },
        },
        orderBy: [{ isFeatured: 'desc' }, { ratingAvg: 'desc' }, { publishedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.professional.count({ where }),
    ]);
    return { items, total, page, limit };
  }
}
