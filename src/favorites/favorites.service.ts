import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        // Favorite only has professionalId - need relation or manual join
      },
    });
  }

  async listWithPros(userId: string) {
    const favs = await this.prisma.favorite.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    const ids = favs.map((f) => f.professionalId);
    const pros = await this.prisma.professional.findMany({
      where: { id: { in: ids }, status: 'approved' },
      include: {
        user: { select: { profile: { select: { displayName: true, avatarUrl: true } } } },
      },
    });
    const map = new Map(pros.map((p) => [p.id, p]));
    return favs
      .map((f) => ({ ...f, professional: map.get(f.professionalId) }))
      .filter((f) => f.professional);
  }

  async add(userId: string, professionalId: string) {
    const pro = await this.prisma.professional.findUnique({ where: { id: professionalId } });
    if (!pro || pro.status !== 'approved') throw new NotFoundException('زیباگر یافت نشد');
    try {
      return await this.prisma.favorite.create({
        data: { userId, professionalId },
      });
    } catch {
      throw new ConflictException('قبلاً در علاقه‌مندی‌هاست');
    }
  }

  async remove(userId: string, professionalId: string) {
    await this.prisma.favorite.deleteMany({ where: { userId, professionalId } });
    return { message: 'حذف شد' };
  }
}
