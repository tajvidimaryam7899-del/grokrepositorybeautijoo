import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  Body,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { MediaKind } from '@prisma/client';
import { MediaService } from './media.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

/** Broad accept at multer; MediaService sniffs magic bytes. */
const MULTER_ACCEPT = new Set([
  'image/jpeg',
  'image/jpg',
  'image/pjpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
  'application/octet-stream',
  '',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

@ApiTags('media')
@ApiBearerAuth()
@Roles('professional', 'admin')
@Controller('professionals/me/media')
export class MediaController {
  private readonly logger = new Logger(MediaController.name);

  constructor(private readonly service: MediaService) {}

  @Get()
  list(@CurrentUser('id') userId: string, @Query('kind') kind?: MediaKind) {
    return this.service.listMine(userId, kind);
  }

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        kind: { type: 'string', enum: Object.values(MediaKind) },
        professionalServiceId: { type: 'string' },
      },
      required: ['file', 'kind'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file) {
          return cb(new BadRequestException('فایل ارسال نشده است') as unknown as Error, false);
        }
        const mime = (file.mimetype || '').toLowerCase().trim();
        if (mime && !MULTER_ACCEPT.has(mime) && !mime.startsWith('image/')) {
          return cb(
            new BadRequestException(
              'فرمت این فایل پشتیبانی نمی‌شود. فقط JPG، PNG، WEBP، GIF یا HEIC مجاز است.',
            ) as unknown as Error,
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async upload(
    @CurrentUser('id') userId: string,
    @UploadedFile()
    file: {
      buffer: Buffer;
      mimetype: string;
      originalname: string;
      size: number;
    },
    @Body('kind') kind: string,
    @Body('professionalServiceId') professionalServiceId?: string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('فایل ارسال نشده است');
    }
    if (!kind || typeof kind !== 'string') {
      throw new BadRequestException('نوع تصویر مشخص نشده است');
    }
    const normalizedKind = kind.trim().toLowerCase() as MediaKind;
    const validKinds = Object.values(MediaKind) as string[];
    if (!validKinds.includes(normalizedKind)) {
      throw new BadRequestException('نوع تصویر نامعتبر است. لطفاً دوباره تلاش کنید.');
    }

    this.logger.log(
      `upload user=${userId} kind=${normalizedKind} mime=${file.mimetype || '(empty)'} size=${file.size}`,
    );

    try {
      return await this.service.upload(userId, file, normalizedKind, professionalServiceId);
    } catch (err) {
      if (err && typeof err === 'object' && 'getStatus' in err) throw err;
      this.logger.error(`upload failed user=${userId}: ${(err as Error)?.message}`);
      throw err;
    }
  }

  @Post('publish')
  publish(@CurrentUser('id') userId: string, @Body() body: { ids: string[] }) {
    return this.service.publishAssets(userId, body.ids || []);
  }

  @Delete(':id')
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.service.deleteMine(userId, id);
  }
}
