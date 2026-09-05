import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DayOfWeek } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProfessionalsService } from '../professionals/professionals.service';
import {
  AvailabilityService,
  DAY_MAP,
  TEHRAN_OFFSET_MS,
  formatTime,
  minutesSinceTehranMidnight,
  parseTime,
  tehranDayBounds,
} from '../availability/availability.service';

type RangeInput = { startTime: string; endTime: string };
type DayInput = { dayOfWeek: string; isActive: boolean; ranges: RangeInput[] };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function tehranDateStrFromInstant(instant: Date): string {
  const local = new Date(instant.getTime() + TEHRAN_OFFSET_MS);
  const y = local.getUTCFullYear();
  const mo = String(local.getUTCMonth() + 1).padStart(2, '0');
  const d = String(local.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}

@Injectable()
export class ScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly professionals: ProfessionalsService,
  ) {}

  async getSettings(userId: string) {
    const pro = await this.professionals.requireOwnProfessional(userId);
    const workingHours = await this.prisma.workingHour.findMany({
      where: { professionalId: pro.id },
      include: { breaks: true },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    return { slotIntervalMin: pro.slotIntervalMin, workingHours };
  }

  async updateWorkingHours(userId: string, days: DayInput[]) {
    const pro = await this.professionals.requireOwnProfessional(userId);
    if (!Array.isArray(days)) throw new BadRequestException('داده نامعتبر است');

    for (const d of days) {
      if (!d.isActive) continue;
      if (!d.ranges?.length) {
        throw new BadRequestException('برای روز فعال حداقل یک بازه کاری لازم است');
      }
      const sorted = [...d.ranges].sort((a, b) => parseTime(a.startTime) - parseTime(b.startTime));
      for (let i = 0; i < sorted.length; i++) {
        const r = sorted[i];
        if (parseTime(r.startTime) >= parseTime(r.endTime)) {
          throw new BadRequestException('ساعت شروع باید قبل از ساعت پایان باشد');
        }
        if (i > 0 && parseTime(r.startTime) < parseTime(sorted[i - 1].endTime)) {
          throw new BadRequestException('بازه‌های کاری یک روز نباید همپوشانی داشته باشند');
        }
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.workingHour.deleteMany({ where: { professionalId: pro.id } });
      for (const d of days) {
        if (!d.isActive) continue;
        for (const r of d.ranges) {
          await tx.workingHour.create({
            data: {
              professionalId: pro.id,
              dayOfWeek: d.dayOfWeek as DayOfWeek,
              startTime: r.startTime,
              endTime: r.endTime,
              isActive: true,
            },
          });
        }
      }
    });

    return this.getSettings(userId);
  }

  async updateInterval(userId: string, slotIntervalMin: number) {
    const pro = await this.professionals.requireOwnProfessional(userId);
    await this.prisma.professional.update({
      where: { id: pro.id },
      data: { slotIntervalMin },
    });
    return { slotIntervalMin };
  }

  async getDay(userId: string, dateStr: string) {
    const pro = await this.professionals.requireOwnProfessional(userId);
    if (!dateStr || !DATE_RE.test(dateStr)) throw new BadRequestException('تاریخ نامعتبر است');

    const { dayStart, dayEnd, dayOfWeek } = tehranDayBounds(dateStr);
    const step = pro.slotIntervalMin || 30;

    const [hours, timeOffs, bookings] = await Promise.all([
      this.prisma.workingHour.findMany({
        where: { professionalId: pro.id, dayOfWeek, isActive: true },
        include: { breaks: true },
        orderBy: { startTime: 'asc' },
      }),
      this.prisma.timeOff.findMany({
        where: { professionalId: pro.id, startAt: { lt: dayEnd }, endAt: { gt: dayStart } },
      }),
      this.prisma.booking.findMany({
        where: {
          professionalId: pro.id,
          status: { in: ['pending', 'confirmed'] },
          startAt: { lt: dayEnd },
          endAt: { gt: dayStart },
        },
        include: {
          customer: { select: { phone: true, profile: { select: { displayName: true } } } },
          items: { include: { service: { select: { name: true } } } },
        },
        orderBy: { startAt: 'asc' },
      }),
    ]);

    if (hours.length === 0) {
      return { date: dateStr, slotIntervalMin: step, isWorkingDay: false, slots: [] };
    }

    type Busy =
      | { kind: 'break'; start: number; end: number }
      | { kind: 'block'; start: number; end: number; timeOffId: string; reason: string | null }
      | {
          kind: 'booking';
          start: number;
          end: number;
          booking: { id: string; customerName: string | null; services: string[]; startAt: Date; endAt: Date };
        };

    const busy: Busy[] = [];
    for (const wh of hours) {
      for (const b of wh.breaks) {
        busy.push({ kind: 'break', start: parseTime(b.startTime), end: parseTime(b.endTime) });
      }
    }
    for (const t of timeOffs) {
      busy.push({
        kind: 'block',
        start: Math.max(0, minutesSinceTehranMidnight(t.startAt, dayStart)),
        end: Math.min(24 * 60, minutesSinceTehranMidnight(t.endAt, dayStart)),
        timeOffId: t.id,
        reason: t.reason,
      });
    }
    for (const bk of bookings) {
      busy.push({
        kind: 'booking',
        start: Math.max(0, minutesSinceTehranMidnight(bk.startAt, dayStart)),
        end: Math.min(24 * 60, minutesSinceTehranMidnight(bk.endAt, dayStart)),
        booking: {
          id: bk.id,
          customerName: bk.customer?.profile?.displayName || bk.customer?.phone || null,
          services: bk.items.map((it) => it.service?.name).filter(Boolean) as string[],
          startAt: bk.startAt,
          endAt: bk.endAt,
        },
      });
    }

    const now = Date.now();
    const slots: Array<{
      start: string;
      end: string;
      status: 'free' | 'booked' | 'blocked' | 'closed';
      isPast: boolean;
      timeOffId?: string;
      reason?: string | null;
      isBreak?: boolean;
      booking?: { id: string; customerName: string | null; services: string[] };
    }> = [];

    for (const wh of hours) {
      const rStart = parseTime(wh.startTime);
      const rEnd = parseTime(wh.endTime);
      for (let t = rStart; t < rEnd; t += step) {
        const slotEnd = Math.min(t + step, rEnd);
        const booking = busy.find((x) => x.kind === 'booking' && t < x.end && slotEnd > x.start) as
          | Extract<Busy, { kind: 'booking' }>
          | undefined;
        const block = busy.find((x) => x.kind === 'block' && t < x.end && slotEnd > x.start) as
          | Extract<Busy, { kind: 'block' }>
          | undefined;
        const brk = busy.find((x) => x.kind === 'break' && t < x.end && slotEnd > x.start);

        const startAtUtc = new Date(dayStart.getTime() + t * 60_000);
        const isPast = startAtUtc.getTime() < now;

        if (booking) {
          slots.push({
            start: formatTime(t),
            end: formatTime(slotEnd),
            status: 'booked',
            isPast,
            booking: {
              id: booking.booking.id,
              customerName: booking.booking.customerName,
              services: booking.booking.services,
            },
          });
        } else if (block) {
          slots.push({
            start: formatTime(t),
            end: formatTime(slotEnd),
            status: 'blocked',
            isPast,
            timeOffId: block.timeOffId,
            reason: block.reason,
          });
        } else if (brk) {
          slots.push({ start: formatTime(t), end: formatTime(slotEnd), status: 'blocked', isPast, isBreak: true });
        } else {
          slots.push({ start: formatTime(t), end: formatTime(slotEnd), status: 'free', isPast });
        }
      }
    }

    return { date: dateStr, slotIntervalMin: step, isWorkingDay: true, slots };
  }

  async getMonth(userId: string, fromStr: string, toStr: string) {
    const pro = await this.professionals.requireOwnProfessional(userId);
    if (!fromStr || !toStr || !DATE_RE.test(fromStr) || !DATE_RE.test(toStr)) {
      throw new BadRequestException('بازه تاریخ نامعتبر است');
    }
    const { dayStart: rangeStart } = tehranDayBounds(fromStr);
    const { dayEnd: rangeEnd } = tehranDayBounds(toStr);
    if (rangeEnd.getTime() < rangeStart.getTime()) {
      throw new BadRequestException('بازه تاریخ نامعتبر است');
    }
    const totalDays = Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 86_400_000);
    if (totalDays > 62) throw new BadRequestException('بازه تاریخ بیش از حد بزرگ است');

    const [activeHours, bookings, timeOffs] = await Promise.all([
      this.prisma.workingHour.findMany({
        where: { professionalId: pro.id, isActive: true },
        select: { dayOfWeek: true },
      }),
      this.prisma.booking.findMany({
        where: {
          professionalId: pro.id,
          status: { in: ['pending', 'confirmed'] },
          startAt: { lt: new Date(rangeEnd.getTime() + 1) },
          endAt: { gt: rangeStart },
        },
        select: { startAt: true },
      }),
      this.prisma.timeOff.findMany({
        where: {
          professionalId: pro.id,
          startAt: { lt: new Date(rangeEnd.getTime() + 1) },
          endAt: { gt: rangeStart },
        },
        select: { startAt: true, endAt: true },
      }),
    ]);

    const activeDaySet = new Set(activeHours.map((h) => h.dayOfWeek));
    const now = Date.now();
    const days: Array<{
      date: string;
      dayOfWeek: DayOfWeek;
      isWorkingDay: boolean;
      bookingsCount: number;
      hasBlock: boolean;
      isPast: boolean;
    }> = [];

    let cursor = new Date(rangeStart.getTime());
    while (cursor.getTime() <= rangeEnd.getTime()) {
      const dStart = cursor;
      const dEnd = new Date(cursor.getTime() + 86_400_000 - 1);
      const dow = DAY_MAP[new Date(cursor.getTime() + 12 * 3_600_000).getUTCDay()];
      const bookingsCount = bookings.filter((b) => b.startAt >= dStart && b.startAt <= dEnd).length;
      const hasBlock = timeOffs.some((t) => t.startAt < dEnd && t.endAt > dStart);
      days.push({
        date: tehranDateStrFromInstant(dStart),
        dayOfWeek: dow,
        isWorkingDay: activeDaySet.has(dow),
        bookingsCount,
        hasBlock,
        isPast: dEnd.getTime() < now,
      });
      cursor = new Date(cursor.getTime() + 86_400_000);
    }

    return { from: fromStr, to: toStr, days };
  }

  async createBlock(userId: string, dateStr: string, ranges: RangeInput[], reason?: string) {
    const pro = await this.professionals.requireOwnProfessional(userId);
    if (!dateStr || !DATE_RE.test(dateStr)) throw new BadRequestException('تاریخ نامعتبر است');
    if (!ranges?.length) throw new BadRequestException('حداقل یک بازه لازم است');

    const created: { id: string; startAt: Date; endAt: Date; reason: string | null }[] = [];
    for (const r of ranges) {
      if (parseTime(r.startTime) >= parseTime(r.endTime)) {
        throw new BadRequestException('ساعت شروع باید قبل از ساعت پایان باشد');
      }
      const startAt = AvailabilityService.tehranLocalToUtc(dateStr, r.startTime);
      const endAt = AvailabilityService.tehranLocalToUtc(dateStr, r.endTime);
      if (endAt.getTime() <= Date.now()) {
        throw new BadRequestException('نمی‌توان زمان گذشته را مسدود کرد');
      }
      const conflict = await this.prisma.booking.findFirst({
        where: {
          professionalId: pro.id,
          status: { in: ['pending', 'confirmed'] },
          startAt: { lt: endAt },
          endAt: { gt: startAt },
        },
      });
      if (conflict) {
        throw new ConflictException('این بازه شامل نوبت رزروشده است و قابل مسدودسازی نیست');
      }
      const timeOff = await this.prisma.timeOff.create({
        data: { professionalId: pro.id, startAt, endAt, reason: reason?.trim() || null },
      });
      created.push(timeOff);
    }
    return { created };
  }

  async removeBlock(userId: string, id: string) {
    const pro = await this.professionals.requireOwnProfessional(userId);
    const timeOff = await this.prisma.timeOff.findUnique({ where: { id } });
    if (!timeOff || timeOff.professionalId !== pro.id) {
      throw new NotFoundException('بازه مسدودشده یافت نشد');
    }
    await this.prisma.timeOff.delete({ where: { id } });
    return { success: true };
  }
}
