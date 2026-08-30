import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ProfessionalsService } from '../professionals/professionals.service';
import { STORAGE_PROVIDER, StorageProvider } from '../storage/storage.provider';
import { MediaKind, MediaStatus } from '@prisma/client';

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const VIDEO_MIME = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
};

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

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

    const mime = (file.mimetype || '').toLowerCase();
    const isImage = IMAGE_MIME.has(mime);
    const isVideo = VIDEO_MIME.has(mime);
    if (!isImage && !isVideo) {
      throw new BadRequestException(
        'فرمت این تصویر پشتیبانی نمی‌شود. فقط JPG، PNG، WEBP و GIF مجاز است.',
      );
    }
    if (isImage && file.size > 8 * 1024 * 1024) {
      throw new BadRequestException('حجم تصویر بیش از حد مجاز است (حداکثر ۸ مگابایت).');
    }
    if (isVideo && file.size > 50 * 1024 * 1024) {
      throw new BadRequestException('حجم ویدیو بیش از حد مجاز است (حداکثر ۵۰ مگابایت).');
    }

    const pro = await this.professionals.requireOwnProfessional(userId);
    if (professionalServiceId) {
      const ps = await this.prisma.professionalService.findFirst({
        where: { id: professionalServiceId, professionalId: pro.id },
      });
      if (!ps) throw new NotFoundException('خدمت یافت نشد');
    }

    const fromName = (file.originalname.split('.').pop() || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    const ext = MIME_EXT[mime] || fromName || 'bin';
    const key = `professionals/${pro.id}/${kind}/${randomUUID()}.${ext}`;

    await this.storage.upload(key, file.buffer, mime);
    const publicUrl = this.storage.getPublicUrl(key);

    const asset = await this.prisma.mediaAsset.create({
      data: {
        professionalId: pro.id,
        professionalServiceId: professionalServiceId || null,
        kind,
        storageKey: key,
        publicUrl,
        mimeType: mime,
        status: MediaStatus.draft,
      },
    });

    try {
      if (kind === MediaKind.logo) {
        await this.prisma.professional.update({
          where: { id: pro.id },
          data: { logoUrl: publicUrl },
        });
      } else if (kind === MediaKind.cover) {
        await this.prisma.professional.update({
          where: { id: pro.id },
          data: { coverImageUrl: publicUrl },
        });
      } else if (kind === MediaKind.avatar) {
        await this.prisma.profile.upsert({
          where: { userId },
          update: { avatarUrl: publicUrl },
          create: {
            userId,
            displayName: pro.title || 'زیباگر',
            avatarUrl: publicUrl,
          },
        });
      }
    } catch (err) {
      this.logger.warn(
        `media metadata link failed kind=${kind} asset=${asset.id}: ${(err as Error).message}`,
      );
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
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id, professionalId: pro.id },
    });
    if (!asset) throw new NotFoundException('تصویر یافت نشد');
    await this.storage.delete(asset.storageKey);
    await this.prisma.mediaAsset.delete({ where: { id } });
    return { ok: true };
  }
}
