import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProfessionalsService } from '../professionals/professionals.service';

@Injectable()
export class LocationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly professionals: ProfessionalsService,
  ) {}

  async addLocation(
    userId: string,
    data: {
      name?: string; address?: string; city: string; province?: string;
      latitude?: number; longitude?: number; isPrimary?: boolean;
    },
  ) {
    if (!data.city?.trim()) {
      throw new BadRequestException('شهر الزامی است');
    }
    const pro = await this.professionals.requireOwnProfessional(userId);
    const name = (data.name?.trim() || data.city.trim());
    const address = (data.address?.trim() || `${data.province || ''} ${data.city}`.trim());
    const location = await this.prisma.location.create({
      data: {
        name,
        address,
        city: data.city.trim(),
        province: data.province || null,
        latitude: data.latitude != null ? data.latitude : null,
        longitude: data.longitude != null ? data.longitude : null,
      },
    });
    if (data.isPrimary) {
      await this.prisma.professionalLocation.updateMany({
        where: { professionalId: pro.id },
        data: { isPrimary: false },
      });
    }
    await this.prisma.professionalLocation.create({
      data: {
        professionalId: pro.id,
        locationId: location.id,
        isPrimary: data.isPrimary ?? true,
      },
    });
    return location;
  }

  async listMine(userId: string) {
    const pro = await this.professionals.requireOwnProfessional(userId);
    return this.prisma.professionalLocation.findMany({
      where: { professionalId: pro.id },
      include: { location: true },
    });
  }

  async setWorkingHours(
    userId: string,
    data: {
      dayOfWeek: string;
      startTime: string;
      endTime: string;
      breaks?: { startTime: string; endTime: string }[];
    },
  ) {
    const pro = await this.professionals.requireOwnProfessional(userId);
    const existing = await this.prisma.workingHour.findFirst({
      where: {
        professionalId: pro.id,
        dayOfWeek: data.dayOfWeek as never,
        startTime: data.startTime,
      },
    });
    if (existing) {
      await this.prisma.workingHourBreak.deleteMany({ where: { workingHourId: existing.id } });
      return this.prisma.workingHour.update({
        where: { id: existing.id },
        data: {
          endTime: data.endTime,
          isActive: true,
          breaks: {
            create: (data.breaks || []).map((b) => ({
              startTime: b.startTime,
              endTime: b.endTime,
            })),
          },
        },
        include: { breaks: true },
      });
    }
    return this.prisma.workingHour.create({
      data: {
        professionalId: pro.id,
        dayOfWeek: data.dayOfWeek as never,
        startTime: data.startTime,
        endTime: data.endTime,
        breaks: {
          create: (data.breaks || []).map((b) => ({
            startTime: b.startTime,
            endTime: b.endTime,
          })),
        },
      },
      include: { breaks: true },
    });
  }

  async listWorkingHours(userId: string) {
    const pro = await this.professionals.requireOwnProfessional(userId);
    return this.prisma.workingHour.findMany({
      where: { professionalId: pro.id },
      include: { breaks: true },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  async addTimeOff(userId: string, data: { startAt: string; endAt: string; reason?: string }) {
    const pro = await this.professionals.requireOwnProfessional(userId);
    return this.prisma.timeOff.create({
      data: {
        professionalId: pro.id,
        startAt: new Date(data.startAt),
        endAt: new Date(data.endAt),
        reason: data.reason,
      },
    });
  }
}
