import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProfessionalsService } from '../professionals/professionals.service';

type LocationInput = {
  name?: string;
  address?: string;
  city: string;
  province?: string;
  latitude?: number;
  longitude?: number;
  isPrimary?: boolean;
  precision?: 'exact' | 'approximate';
};

@Injectable()
export class LocationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly professionals: ProfessionalsService,
  ) {}

  private normalizeCoords(data: LocationInput) {
    const precision = data.precision || (data.latitude != null && data.longitude != null ? 'exact' : 'approximate');
    // Approximate: store city-level only, do not expose exact pin publicly.
    // We still keep lat/lng for internal map centering when provided (city center),
    // but mark address with area note when approximate without street.
    let latitude = data.latitude != null ? Number(data.latitude) : null;
    let longitude = data.longitude != null ? Number(data.longitude) : null;
    if (precision === 'approximate') {
      // Round to ~1km precision so exact building is not stored
      if (latitude != null) latitude = Math.round(latitude * 100) / 100;
      if (longitude != null) longitude = Math.round(longitude * 100) / 100;
    }
    return { precision, latitude, longitude };
  }

  private buildAddress(data: LocationInput, precision: string) {
    const base = (data.address?.trim() || '').trim();
    if (precision === 'approximate' && !base) {
      return `محدوده ${data.city}${data.province ? `، ${data.province}` : ''}`;
    }
    if (precision === 'approximate' && base && !base.includes('محدوده')) {
      return `${base} (محدوده تقریبی)`;
    }
    return base || `${data.province || ''} ${data.city}`.trim();
  }

  /** Create or update the primary location for this professional */
  async addOrUpdatePrimary(userId: string, data: LocationInput) {
    if (!data.city?.trim()) throw new BadRequestException('شهر الزامی است');
    const pro = await this.professionals.requireOwnProfessional(userId);
    const { precision, latitude, longitude } = this.normalizeCoords(data);
    const name = data.name?.trim() || data.city.trim();
    const address = this.buildAddress(data, precision);

    const existingLink = await this.prisma.professionalLocation.findFirst({
      where: { professionalId: pro.id, isPrimary: true },
      include: { location: true },
    });

    if (existingLink) {
      const location = await this.prisma.location.update({
        where: { id: existingLink.locationId },
        data: {
          name,
          address,
          city: data.city.trim(),
          province: data.province || null,
          latitude,
          longitude,
        },
      });
      return { ...location, precision };
    }

    const location = await this.prisma.location.create({
      data: {
        name,
        address,
        city: data.city.trim(),
        province: data.province || null,
        latitude,
        longitude,
      },
    });
    await this.prisma.professionalLocation.updateMany({
      where: { professionalId: pro.id },
      data: { isPrimary: false },
    });
    await this.prisma.professionalLocation.create({
      data: {
        professionalId: pro.id,
        locationId: location.id,
        isPrimary: true,
      },
    });
    return { ...location, precision };
  }

  async addLocation(userId: string, data: LocationInput) {
    return this.addOrUpdatePrimary(userId, data);
  }

  async updateLocation(userId: string, locationId: string, data: LocationInput) {
    const pro = await this.professionals.requireOwnProfessional(userId);
    const link = await this.prisma.professionalLocation.findFirst({
      where: { professionalId: pro.id, locationId },
    });
    if (!link) throw new NotFoundException('موقعیت یافت نشد');
    if (!data.city?.trim()) throw new BadRequestException('شهر الزامی است');
    const { precision, latitude, longitude } = this.normalizeCoords(data);
    const name = data.name?.trim() || data.city.trim();
    const address = this.buildAddress(data, precision);
    const location = await this.prisma.location.update({
      where: { id: locationId },
      data: {
        name,
        address,
        city: data.city.trim(),
        province: data.province || null,
        latitude,
        longitude,
      },
    });
    return { ...location, precision };
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
