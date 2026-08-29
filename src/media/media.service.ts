import { Injectable, Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ProfessionalsService } from '../professionals/professionals.service';
import { STORAGE_PROVIDER, StorageProvider } from '../storage/storage.provider';
import { MediaKind, MediaStatus } from '@prisma/client';

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const VIDEO_MIME = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly professionals: ProfessionalsService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  async upload(
    userId: string,
    file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
    kind: MediaKind,
    professionalServiceId?: string,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('فایل الزامی است');
    const isImage = IMAGE_MIME.has(file.mimetype);
    const isVideo = VIDEO_MIME.has(file.mimetype);
    if (!isImage && !isVideo) throw new BadRequestException('فقط تصویر یا ویدیو مجاز است');
    if (isImage && file.size > 8 * 1024 * 1024) throw new BadRequestException('حداکثر حجم تصویر ۸ مگابایت');
    if (isVideo && file.size > 50 * 1024 * 1024) throw new BadRequestException('حداکثر حجم ویدیو ۵۰ مگابایت');

    const pro = await this.professionals.requireOwnProfessional(userId);
    if (professionalServiceId) {
      const ps = await this.prisma.professionalService.findFirst({
        where: { id: professionalServiceId, professionalId: pro.id },
      });
      if (!ps) throw new NotFoundException('خدمت یافت نشد');
    }
    const ext = (file.originalname.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
    const key = `professionals/${pro.id}/${kind}/${randomUUID()}.${ext}`;
    await this.storage.upload(key, file.buffer, file.mimetype);
    const publicUrl = this.storage.getPublicUrl(key);
    const asset = await this.prisma.mediaAsset.create({
      data: {
        professionalId: pro.id,
        professionalServiceId: professionalServiceId || null,
        kind,
        storageKey: key,
        publicUrl,
        mimeType: file.mimetype,
        status: MediaStatus.draft,
      },
    });
    if (kind === MediaKind.logo) {
      await this.prisma.professional.update({ where: { id: pro.id }, data: { logoUrl: publicUrl } });
    } else if (kind === MediaKind.cover) {
      await this.prisma.professional.update({ where: { id: pro.id }, data: { coverImageUrl: publicUrl } });
    } else if (kind === MediaKind.avatar) {
      await this.prisma.profile.update({ where: { userId }, data: { avatarUrl: publicUrl } });
    }
    return asset;
  }

  async listMine(userId: string, kind?: MediaKind) {
    const pro = await this.professionals.requireOwnProfessional(userId);
    return this.prisma.mediaAsset.findMany({
      where: { professionalId: pro.id, ...(kind ? { kind } : {}) },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async publishAssets(userId: string, ids: string[]) {
    const pro = await this.professionals.requireOwnProfessional(userId);
    if (!ids?.length) throw new BadRequestException('شناسه فایل‌ها الزامی است');
    await this.prisma.mediaAsset.updateMany({
      where: { professionalId: pro.id, id: { in: ids } },
      data: { status: MediaStatus.published },
    });
    return this.listMine(userId);
  }

  async deleteMine(userId: string, id: string) {
    const pro = await this.professionals.requireOwnProfessional(userId);
    const asset = await this.prisma.mediaAsset.findFirst({ where: { id, professionalId: pro.id } });
    if (!asset) throw new NotFoundException();
    await this.storage.delete(asset.storageKey);
    await this.prisma.mediaAsset.delete({ where: { id } });
    return { ok: true };
  }
}
