import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DayOfWeek } from '@prisma/client';

/** Iran Standard Time — fixed UTC+3:30 (no DST as of 2026). */
export const TEHRAN_OFFSET_MS = 3.5 * 60 * 60 * 1000;

export const DAY_MAP: Record<number, DayOfWeek> = {
  0: DayOfWeek.sunday,
  1: DayOfWeek.monday,
  2: DayOfWeek.tuesday,
  3: DayOfWeek.wednesday,
  4: DayOfWeek.thursday,
  5: DayOfWeek.friday,
  6: DayOfWeek.saturday,
};

export function parseTime(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

export function formatTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** YYYY-MM-DD as a calendar day in Tehran → UTC bounds for that local day. */
export function tehranDayBounds(dateStr: string): { dayStart: Date; dayEnd: Date; dayOfWeek: DayOfWeek } {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    throw new BadRequestException('تاریخ نامعتبر');
  }
  const [y, mo, d] = parts;
  // Local Tehran midnight = that UTC calendar midnight minus offset
  const dayStartMs = Date.UTC(y, mo - 1, d, 0, 0, 0, 0) - TEHRAN_OFFSET_MS;
  const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000 - 1;
  const noonMs = dayStartMs + 12 * 60 * 60 * 1000;
  const dayOfWeek = DAY_MAP[new Date(noonMs).getUTCDay()];
  return {
    dayStart: new Date(dayStartMs),
    dayEnd: new Date(dayEndMs),
    dayOfWeek,
  };
}

/** Minutes since Tehran midnight for a timestamptz instant on that day. */
export function minutesSinceTehranMidnight(instant: Date, dayStart: Date): number {
  return (instant.getTime() - dayStart.getTime()) / 60_000;
}

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async getSlots(professionalId: string, dateStr: string, durationMin: number) {
    if (!durationMin || durationMin < 5) throw new BadRequestException('مدت نامعتبر');
    const pro = await this.prisma.professional.findUnique({ where: { id: professionalId } });
    if (!pro || pro.status !== 'approved') throw new NotFoundException('زیباگر یافت نشد');

    let bounds: { dayStart: Date; dayEnd: Date; dayOfWeek: DayOfWeek };
    try {
      bounds = tehranDayBounds(dateStr);
    } catch {
      throw new BadRequestException('تاریخ نامعتبر');
    }
    const { dayStart, dayEnd, dayOfWeek } = bounds;

    const hours = await this.prisma.workingHour.findMany({
      where: { professionalId, dayOfWeek, isActive: true },
      include: { breaks: true },
    });
    if (hours.length === 0) return { date: dateStr, slots: [] };

    const [timeOffs, manuals, bookings] = await Promise.all([
      this.prisma.timeOff.findMany({
        where: {
          professionalId,
          startAt: { lt: dayEnd },
          endAt: { gt: dayStart },
        },
      }),
      this.prisma.manualReservation.findMany({
        where: {
          professionalId,
          startAt: { lt: dayEnd },
          endAt: { gt: dayStart },
        },
      }),
      this.prisma.booking.findMany({
        where: {
          professionalId,
          status: { in: ['pending', 'confirmed'] },
          startAt: { lt: dayEnd },
          endAt: { gt: dayStart },
        },
        select: { startAt: true, endAt: true },
      }),
    ]);

    const busy: { start: number; end: number }[] = [];
    for (const t of timeOffs) {
      busy.push({
        start: Math.max(0, minutesSinceTehranMidnight(t.startAt, dayStart)),
        end: Math.min(24 * 60, minutesSinceTehranMidnight(t.endAt, dayStart)),
      });
    }
    for (const m of manuals) {
      busy.push({
        start: Math.max(0, minutesSinceTehranMidnight(m.startAt, dayStart)),
        end: Math.min(24 * 60, minutesSinceTehranMidnight(m.endAt, dayStart)),
      });
    }
    for (const b of bookings) {
      busy.push({
        start: Math.max(0, minutesSinceTehranMidnight(b.startAt, dayStart)),
        end: Math.min(24 * 60, minutesSinceTehranMidnight(b.endAt, dayStart)),
      });
    }

    const slots: { start: string; end: string }[] = [];
    const step = 15;

    for (const wh of hours) {
      const whStart = parseTime(wh.startTime);
      const whEnd = parseTime(wh.endTime);
      const breaks = wh.breaks.map((b) => ({
        start: parseTime(b.startTime),
        end: parseTime(b.endTime),
      }));

      for (let t = whStart; t + durationMin <= whEnd; t += step) {
        const slotEnd = t + durationMin;
        const inBreak = breaks.some((b) => t < b.end && slotEnd > b.start);
        if (inBreak) continue;
        const inBusy = busy.some((b) => t < b.end && slotEnd > b.start);
        if (inBusy) continue;
        slots.push({ start: formatTime(t), end: formatTime(slotEnd) });
      }
    }

    return { date: dateStr, professionalId, durationMin, slots, timezone: 'Asia/Tehran' };
  }

  /**
   * Build a UTC Date for local Tehran wall-clock time on dateStr (YYYY-MM-DD) + HH:MM.
   */
  static tehranLocalToUtc(dateStr: string, hhmm: string): Date {
    const [y, mo, d] = dateStr.split('-').map(Number);
    const [h, mi] = hhmm.split(':').map(Number);
    const localAsUtcMs = Date.UTC(y, mo - 1, d, h, mi, 0, 0);
    return new Date(localAsUtcMs - TEHRAN_OFFSET_MS);
  }
}
