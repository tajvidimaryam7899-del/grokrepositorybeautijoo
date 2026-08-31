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
import { sniffImage } from './image-sniff';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const VIDEO_MIME = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

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

    const clientMime = (file.mimetype || '').toLowerCase().trim();
    let buffer = file.buffer;
    let mime = clientMime;
    let ext = 'bin';

    const isVideo = VIDEO_MIME.has(clientMime);
    if (isVideo) {
      if (file.size > MAX_VIDEO_BYTES) {
        throw new BadRequestException('حجم ویدیو بیش از حد مجاز است (حداکثر ۵۰ مگابایت).');
      }
      const map: Record<string, string> = {
        'video/mp4': 'mp4',
        'video/webm': 'webm',
        'video/quicktime': 'mov',
      };
      ext = map[clientMime] || 'mp4';
      mime = clientMime;
    } else {
      const sniffed = sniffImage(buffer);
      if (!sniffed) {
        throw new BadRequestException(
          'فرمت این تصویر پشتیبانی نمی‌شود. فقط JPG، PNG، WEBP، GIF یا HEIC مجاز است.',
        );
      }
      if (sniffed.kind === 'heic') {
        buffer = await this.convertHeicToJpeg(buffer);
        mime = 'image/jpeg';
        ext = 'jpg';
        this.logger.log(`heic converted to jpeg user=${userId} bytes=${buffer.length}`);
      } else {
        mime = sniffed.mime;
        ext = sniffed.ext;
      }
      if (buffer.length > MAX_IMAGE_BYTES) {
        throw new BadRequestException('حجم تصویر بیش از حد مجاز است (حداکثر ۸ مگابایت).');
      }
    }

    const pro = await this.professionals.requireOwnProfessional(userId);
    if (professionalServiceId) {
      const ps = await this.prisma.professionalService.findFirst({
        where: { id: professionalServiceId, professionalId: pro.id },
      });
      if (!ps) throw new NotFoundException('خدمت یافت نشد');
    }

    const key = `professionals/${pro.id}/${kind}/${randomUUID()}.${ext}`;
    await this.storage.upload(key, buffer, mime);
    const publicUrl = this.storage.getPublicUrl(key);

    const asset = await this.prisma.mediaAsset.create({
      data: {
        professionalId: pro.id,
        professionalServiceId: professionalServiceId || null,
        kind,
        storageKey: key,
        publicUrl,
        mimeType: mime,
        status: MediaStatus.published,
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

    this.logger.log(
      `upload ok user=${userId} kind=${kind} key=${key} mime=${mime} publicUrlHost=${this.safeHost(publicUrl)}`,
    );
    return asset;
  }

  private safeHost(url: string): string {
    try {
      return new URL(url, 'https://placeholder.local').host || '(relative)';
    } catch {
      return '(invalid)';
    }
  }

  private async convertHeicToJpeg(input: Buffer): Promise<Buffer> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const convert = require('heic-convert') as (opts: {
        buffer: Buffer;
        format: 'JPEG' | 'PNG';
        quality?: number;
      }) => Promise<ArrayBuffer>;
      const out = await convert({ buffer: input, format: 'JPEG', quality: 0.9 });
      return Buffer.from(out);
    } catch (err) {
      this.logger.warn(`heic convert failed: ${(err as Error).message}`);
      throw new BadRequestException(
        'تبدیل تصویر HEIC ناموفق بود. لطفاً تصویر را به‌صورت JPG یا PNG ذخیره و دوباره ارسال کنید.',
      );
    }
  }

  async listMine(userId: string, kind?: MediaKind) {
    const pro = await this.professionals.requireOwnProfessional(userId);
    return this.prisma.mediaAsset.findMany({
      where: {
        professionalId: pro.id,
        ...(kind ? { kind } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async deleteMine(userId: string, id: string) {
    const pro = await this.professionals.requireOwnProfessional(userId);
    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id, professionalId: pro.id },
    });
    if (!asset) throw new NotFoundException('فایل یافت نشد');
    await this.storage.delete(asset.storageKey);
    await this.prisma.mediaAsset.delete({ where: { id } });
    return { ok: true };
  }

  async publishAssets(userId: string, ids: string[]) {
    const pro = await this.professionals.requireOwnProfessional(userId);
    if (!ids?.length) return { count: 0 };
    const result = await this.prisma.mediaAsset.updateMany({
      where: { professionalId: pro.id, id: { in: ids } },
      data: { status: MediaStatus.published },
    });
    return { count: result.count };
  }
}
