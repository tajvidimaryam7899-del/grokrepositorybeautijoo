import { Prisma } from '@prisma/client';
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProfessionalsService } from '../professionals/professionals.service';

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly professionals: ProfessionalsService,
  ) {}

  /** Hierarchical categories (parent → children) for catalog UI */
  async listCategories() {
    const all = await this.prisma.serviceCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        services: { where: { isActive: true }, orderBy: { name: 'asc' } },
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: {
            services: { where: { isActive: true }, orderBy: { name: 'asc' } },
          },
        },
      },
    });
    return all.filter((c) => !c.parentId);
  }

  listServices(categorySlug?: string) {
    return this.prisma.service.findMany({
      where: {
        isActive: true,
        ...(categorySlug ? { category: { slug: categorySlug } } : {}),
      },
      include: { category: true },
      orderBy: { name: 'asc' },
    });
  }

  async upsertProfessionalService(
    userId: string,
    data: {
      serviceId: string;
      durationMin: number;
      price: number;
      bufferMin?: number;
      description?: string;
    },
  ) {
    const pro = await this.professionals.requireOwnProfessional(userId);
    const service = await this.prisma.service.findUnique({
      where: { id: data.serviceId },
    });
    if (!service) throw new NotFoundException('خدمت یافت نشد');

    return this.prisma.professionalService.upsert({
      where: {
        professionalId_serviceId: {
          professionalId: pro.id,
          serviceId: data.serviceId,
        },
      },
      update: {
        durationMin: data.durationMin,
        price: data.price,
        bufferMin: data.bufferMin ?? 0,
        description: data.description,
        isActive: true,
      },
      create: {
        professionalId: pro.id,
        serviceId: data.serviceId,
        durationMin: data.durationMin,
        price: data.price,
        bufferMin: data.bufferMin ?? 0,
        description: data.description,
      },
      include: {
        service: { include: { category: true } },
        priceRules: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        durationRules: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
  }

  async listMyServices(userId: string) {
    const pro = await this.professionals.requireOwnProfessional(userId);
    return this.prisma.professionalService.findMany({
      where: { professionalId: pro.id },
      include: {
        service: { include: { category: true } },
        priceRules: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } },
        durationRules: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
  }

  async deactivateMyService(userId: string, id: string) {
    const pro = await this.professionals.requireOwnProfessional(userId);
    const ps = await this.prisma.professionalService.findFirst({
      where: { id, professionalId: pro.id },
    });
    if (!ps) throw new NotFoundException();
    return this.prisma.professionalService.update({
      where: { id },
      data: { isActive: false },
    });
  }

  private async requireOwnPs(userId: string, professionalServiceId: string) {
    const pro = await this.professionals.requireOwnProfessional(userId);
    const ps = await this.prisma.professionalService.findFirst({
      where: { id: professionalServiceId, professionalId: pro.id },
    });
    if (!ps) throw new NotFoundException('خدمت زیباگر یافت نشد');
    return { pro, ps };
  }

  async listPriceRules(userId: string, professionalServiceId: string) {
    await this.requireOwnPs(userId, professionalServiceId);
    return this.prisma.servicePriceRule.findMany({
      where: { professionalServiceId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async upsertPriceRule(
    userId: string,
    professionalServiceId: string,
    data: {
      id?: string;
      label: string;
      price: number;
      attributes?: Record<string, unknown>;
      sortOrder?: number;
    },
  ) {
    await this.requireOwnPs(userId, professionalServiceId);
    if (!data.label?.trim()) throw new BadRequestException('برچسب الزامی است');
    if (data.price == null || data.price < 0) throw new BadRequestException('قیمت نامعتبر است');

    if (data.id) {
      const existing = await this.prisma.servicePriceRule.findFirst({
        where: { id: data.id, professionalServiceId },
      });
      if (!existing) throw new NotFoundException('قانون قیمت یافت نشد');
      return this.prisma.servicePriceRule.update({
        where: { id: data.id },
        data: {
          label: data.label.trim(),
          price: data.price,
          attributes: (data.attributes as Prisma.InputJsonValue | undefined) ?? undefined,
          sortOrder: data.sortOrder ?? existing.sortOrder,
          isActive: true,
        },
      });
    }

    return this.prisma.servicePriceRule.create({
      data: {
        professionalServiceId,
        label: data.label.trim(),
        price: data.price,
        attributes: (data.attributes as Prisma.InputJsonValue | undefined) ?? undefined,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  async deactivatePriceRule(userId: string, ruleId: string) {
    const rule = await this.prisma.servicePriceRule.findUnique({ where: { id: ruleId } });
    if (!rule) throw new NotFoundException();
    await this.requireOwnPs(userId, rule.professionalServiceId);
    return this.prisma.servicePriceRule.update({
      where: { id: ruleId },
      data: { isActive: false },
    });
  }

  async listDurationRules(userId: string, professionalServiceId: string) {
    await this.requireOwnPs(userId, professionalServiceId);
    return this.prisma.serviceDurationRule.findMany({
      where: { professionalServiceId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async upsertDurationRule(
    userId: string,
    professionalServiceId: string,
    data: {
      id?: string;
      label: string;
      durationMin: number;
      durationMaxMin?: number;
      attributes?: Record<string, unknown>;
      sortOrder?: number;
    },
  ) {
    await this.requireOwnPs(userId, professionalServiceId);
    if (!data.label?.trim()) throw new BadRequestException('برچسب الزامی است');
    if (!data.durationMin || data.durationMin < 5) {
      throw new BadRequestException('مدت باید حداقل ۵ دقیقه باشد');
    }

    if (data.id) {
      const existing = await this.prisma.serviceDurationRule.findFirst({
        where: { id: data.id, professionalServiceId },
      });
      if (!existing) throw new NotFoundException('قانون مدت یافت نشد');
      return this.prisma.serviceDurationRule.update({
        where: { id: data.id },
        data: {
          label: data.label.trim(),
          durationMin: data.durationMin,
          durationMaxMin: data.durationMaxMin ?? null,
          attributes: (data.attributes as Prisma.InputJsonValue | undefined) ?? undefined,
          sortOrder: data.sortOrder ?? existing.sortOrder,
          isActive: true,
        },
      });
    }

    return this.prisma.serviceDurationRule.create({
      data: {
        professionalServiceId,
        label: data.label.trim(),
        durationMin: data.durationMin,
        durationMaxMin: data.durationMaxMin ?? null,
        attributes: (data.attributes as Prisma.InputJsonValue | undefined) ?? undefined,
        sortOrder: data.sortOrder ?? 0,
      },
    });
  }

  async deactivateDurationRule(userId: string, ruleId: string) {
    const rule = await this.prisma.serviceDurationRule.findUnique({ where: { id: ruleId } });
    if (!rule) throw new NotFoundException();
    await this.requireOwnPs(userId, rule.professionalServiceId);
    return this.prisma.serviceDurationRule.update({
      where: { id: ruleId },
      data: { isActive: false },
    });
  }
}
