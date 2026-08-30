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
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { StorageProvider } from './storage.provider';

/**
 * S3-compatible object storage (Liara Object Storage, AWS S3, MinIO, …).
 *
 * Liara docs require forcePathStyle: true for the AWS SDK.
 * Endpoint examples: https://storage.iran.liara.site  |  https://storage.iran.liara.space
 *
 * Required env (Liara secrets only — never commit):
 *   S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET, S3_PUBLIC_URL
 *
 * Optional:
 *   S3_REGION              default "us-east-1" (Liara also accepts "default")
 *   S3_FORCE_PATH_STYLE    default "true" (set "false" only for pure AWS virtual-host style)
 *
 * Public URL policy for Beautijoo profile media (avatar/cover/logo):
 *   Use a **public-read bucket** (or public objects) and set S3_PUBLIC_URL to the
 *   stable public base from Liara console (do not invent the host).
 *   Rationale: professional pages need long-lived <img src> URLs without
 *   per-request presign. Secrets never leave the server; only object keys are public.
 *   For private documents later, add a presigned-URL path — not needed for gallery images.
 */
@Injectable()
export class S3StorageProvider implements StorageProvider, OnModuleInit {
  private readonly logger = new Logger(S3StorageProvider.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBase: string;
  private readonly forcePathStyle: boolean;

  constructor(private readonly config: ConfigService) {
    const endpoint = (
      process.env.S3_ENDPOINT ||
      config.get<string>('s3Endpoint') ||
      ''
    ).trim();
    const region = (
      process.env.S3_REGION ||
      config.get<string>('s3Region') ||
      'us-east-1'
    ).trim();
    const accessKeyId = (
      process.env.S3_ACCESS_KEY ||
      config.get<string>('s3AccessKey') ||
      ''
    ).trim();
    const secretAccessKey = (
      process.env.S3_SECRET_KEY ||
      config.get<string>('s3SecretKey') ||
      ''
    ).trim();
    this.bucket = (
      process.env.S3_BUCKET ||
      config.get<string>('s3Bucket') ||
      ''
    ).trim();

    // Liara Object Storage: forcePathStyle MUST be true (official SDK samples).
    // Only disable when explicitly S3_FORCE_PATH_STYLE=false (e.g. some AWS setups).
    const fpsRaw = (
      process.env.S3_FORCE_PATH_STYLE ||
      config.get<string>('s3ForcePathStyle') ||
      'true'
    )
      .trim()
      .toLowerCase();
    this.forcePathStyle = fpsRaw !== 'false' && fpsRaw !== '0';

    if (!endpoint || !accessKeyId || !secretAccessKey || !this.bucket) {
      this.logger.error(
        'S3 storage selected but S3_ENDPOINT / S3_ACCESS_KEY / S3_SECRET_KEY / S3_BUCKET are incomplete.',
      );
    }

    this.client = new S3Client({
      region,
      endpoint: endpoint || undefined,
      forcePathStyle: this.forcePathStyle,
      credentials:
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined,
    });

    // Public base MUST come from env — never invent host from endpoint+bucket.
    const explicit = (
      process.env.S3_PUBLIC_URL ||
      process.env.STORAGE_PUBLIC_URL ||
      config.get<string>('s3PublicUrl') ||
      ''
    )
      .trim()
      .replace(/\/$/, '');
    this.publicBase = explicit;

    if (!this.publicBase) {
      this.logger.error(
        'S3_PUBLIC_URL is required when using object storage. ' +
          'Set it to the public base URL shown in the Liara Object Storage console for this bucket.',
      );
    }

    this.logger.log(
      `S3 client config bucket=${this.bucket || '(empty)'} forcePathStyle=${this.forcePathStyle} ` +
        `publicBase=${this.publicBase || '(MISSING)'} endpoint=${endpoint ? '[set]' : '(empty)'}`,
    );
  }

  async onModuleInit() {
    if (!this.bucket) {
      this.logger.error('S3_BUCKET is empty — uploads will fail.');
      return;
    }
    if (!this.publicBase) {
      this.logger.error(
        'S3_PUBLIC_URL is empty — getPublicUrl will fail until it is set in environment.',
      );
    }
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`S3 HeadBucket OK bucket=${this.bucket}`);
    } catch (err) {
      this.logger.warn(
        `S3 HeadBucket check failed (uploads may still work): ${(err as Error).message}`,
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
    if (!this.publicBase) {
      throw new InternalServerErrorException(
        'S3_PUBLIC_URL تنظیم نشده است. آدرس عمومی باکت را از پنل لیارا در متغیر محیطی قرار دهید.',
      );
    }
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: safeKey,
          Body: buffer,
          ContentType: contentType || 'application/octet-stream',
          CacheControl: 'public, max-age=86400',
        }),
      );
      this.logger.log(
        `s3 put key=${safeKey} bytes=${buffer.length} type=${contentType}`,
      );
      return safeKey;
    } catch (err) {
      this.logger.error(`s3 put failed key=${safeKey}: ${(err as Error).message}`);
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

  /**
   * Stable public URL for the object. Requires S3_PUBLIC_URL.
   * Exact host must come from Liara console — do not guess.
   */
  getPublicUrl(key: string): string {
    const safeKey = key.replace(/^\/+/, '');
    if (!this.publicBase) {
      throw new InternalServerErrorException(
        'S3_PUBLIC_URL تنظیم نشده است؛ امکان ساخت URL عمومی وجود ندارد.',
      );
    }
    return `${this.publicBase}/${safeKey}`;
  }

  /** Optional helper for ops/tests — HeadObject */
  async exists(key: string): Promise<boolean> {
    const safeKey = key.replace(/^\/+/, '');
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: safeKey }),
      );
      return true;
    } catch {
      return false;
    }
  }
}
