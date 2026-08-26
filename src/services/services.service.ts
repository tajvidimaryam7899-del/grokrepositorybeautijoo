import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProfessionalsService } from '../professionals/professionals.service';

@Injectable()
export class ServicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly professionals: ProfessionalsService,
  ) {}

  listCategories() {
    return this.prisma.serviceCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: { services: { where: { isActive: true } } },
    });
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
    data: { serviceId: string; durationMin: number; price: number; bufferMin?: number; description?: string },
  ) {
    const pro = await this.professionals.requireOwnProfessional(userId);
    const service = await this.prisma.service.findUnique({ where: { id: data.serviceId } });
    if (!service) throw new NotFoundException('خدمت یافت نشد');

    return this.prisma.professionalService.upsert({
      where: {
        professionalId_serviceId: { professionalId: pro.id, serviceId: data.serviceId },
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
    });
  }

  async listMyServices(userId: string) {
    const pro = await this.professionals.requireOwnProfessional(userId);
    return this.prisma.professionalService.findMany({
      where: { professionalId: pro.id },
      include: { service: { include: { category: true } } },
    });
  }

  async deactivateMyService(userId: string, id: string) {
    const pro = await this.professionals.requireOwnProfessional(userId);
    const ps = await this.prisma.professionalService.findFirst({ where: { id, professionalId: pro.id } });
    if (!ps) throw new NotFoundException();
    return this.prisma.professionalService.update({ where: { id }, data: { isActive: false } });
  }
}
