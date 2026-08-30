import {
  Injectable,
  Logger,
  OnModuleInit,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { StorageProvider } from './storage.provider';

/**
 * S3-compatible object storage (AWS S3, Liara Object Storage, MinIO, etc.).
 *
 * Required env (set in Liara secrets, never commit):
 *   S3_ENDPOINT          e.g. https://storage.iran.liara.space
 *   S3_ACCESS_KEY        access key
 *   S3_SECRET_KEY        secret key
 *   S3_BUCKET            bucket name
 * Optional:
 *   S3_REGION            default us-east-1
 *   S3_FORCE_PATH_STYLE  "true" for path-style URLs
 *   S3_PUBLIC_URL        public base for objects, e.g. https://my-bucket.storage.iran.liara.space
 */
@Injectable()
export class S3StorageProvider implements StorageProvider, OnModuleInit {
  private readonly logger = new Logger(S3StorageProvider.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBase: string;

  constructor(private readonly config: ConfigService) {
    const endpoint =
      process.env.S3_ENDPOINT ||
      config.get<string>('s3Endpoint') ||
      '';
    const region =
      process.env.S3_REGION || config.get<string>('s3Region') || 'us-east-1';
    const accessKeyId =
      process.env.S3_ACCESS_KEY || config.get<string>('s3AccessKey') || '';
    const secretAccessKey =
      process.env.S3_SECRET_KEY || config.get<string>('s3SecretKey') || '';
    this.bucket =
      process.env.S3_BUCKET || config.get<string>('s3Bucket') || '';

    if (!endpoint || !accessKeyId || !secretAccessKey || !this.bucket) {
      this.logger.error(
        'S3 storage selected but S3_ENDPOINT / S3_ACCESS_KEY / S3_SECRET_KEY / S3_BUCKET are incomplete.',
      );
    }

    const forcePathStyle =
      (process.env.S3_FORCE_PATH_STYLE || '').toLowerCase() === 'true';

    this.client = new S3Client({
      region,
      endpoint: endpoint || undefined,
      forcePathStyle,
      credentials:
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined,
    });

    const explicit =
      process.env.S3_PUBLIC_URL ||
      process.env.STORAGE_PUBLIC_URL ||
      config.get<string>('s3PublicUrl') ||
      '';
    if (explicit) {
      this.publicBase = explicit.replace(/\/$/, '');
    } else if (endpoint && this.bucket) {
      try {
        const u = new URL(endpoint);
        this.publicBase = `${u.protocol}//${this.bucket}.${u.host}`;
      } catch {
        this.publicBase = `${endpoint.replace(/\/$/, '')}/${this.bucket}`;
      }
    } else {
      this.publicBase = '';
    }
  }

  async onModuleInit() {
    if (!this.bucket) {
      this.logger.error('S3_BUCKET is empty — uploads will fail.');
      return;
    }
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(
        `S3 storage ready bucket=${this.bucket} publicBase=${this.publicBase || '(none)'}`,
      );
    } catch (err) {
      this.logger.warn(
        `S3 HeadBucket check skipped/failed: ${(err as Error).message}. Uploads may still work if credentials are valid.`,
      );
    }
  }

  async upload(key: string, buffer: Buffer, contentType: string): Promise<string> {
    const safeKey = key.replace(/^\/+/, '');
    if (!this.bucket) {
      throw new InternalServerErrorException(
        'پیکربندی ذخیره‌سازی شیء ناقص است (S3_BUCKET).',
      );
    }
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: safeKey,
          Body: buffer,
          ContentType: contentType,
          CacheControl: 'public, max-age=86400',
        }),
      );
      this.logger.log(
        `s3 put key=${safeKey} bytes=${buffer.length} type=${contentType}`,
      );
      return safeKey;
    } catch (err) {
      this.logger.error(
        `s3 put failed key=${safeKey}: ${(err as Error).message}`,
      );
      throw new InternalServerErrorException(
        'ذخیره‌سازی فایل در Object Storage ناموفق بود. تنظیمات S3 را بررسی کنید.',
      );
    }
  }

  async delete(key: string): Promise<void> {
    const safeKey = key.replace(/^\/+/, '');
    if (!this.bucket) return;
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: safeKey }),
      );
    } catch (err) {
      this.logger.warn(`s3 delete key=${safeKey}: ${(err as Error).message}`);
    }
  }

  getPublicUrl(key: string): string {
    const safeKey = key.replace(/^\/+/, '');
    if (this.publicBase) {
      return `${this.publicBase}/${safeKey}`;
    }
    return `/uploads/${safeKey}`;
  }
}
