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
 * S3-compatible object storage for Liara Object Storage (and AWS/MinIO).
 *
 * Official Liara Node/Next samples:
 *   - endpoint from console (e.g. https://storage.iran.liara.site)
 *   - forcePathStyle: true
 *   - region: often "default" or "us-east-1"
 *
 * AWS SDK JS v3 ≥ 3.729 sends flexible checksums by default; many S3-compatible
 * providers (including Liara) reject those requests. We set
 * requestChecksumCalculation / responseChecksumValidation to WHEN_REQUIRED.
 *
 * Required env (Liara secrets only — never commit):
 *   S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET, S3_PUBLIC_URL
 *
 * S3_PUBLIC_URL must be a real public base (custom domain bound to the bucket),
 * e.g. https://media.beautijoo.com — never invent *.storage.iran.liara.site.
 */
@Injectable()
export class S3StorageProvider implements StorageProvider, OnModuleInit {
  private readonly logger = new Logger(S3StorageProvider.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBase: string;
  private readonly forcePathStyle: boolean;
  private readonly endpointHost: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.cleanEndpoint(
      process.env.S3_ENDPOINT || config.get<string>('s3Endpoint') || '',
    );
    const region = (
      process.env.S3_REGION ||
      config.get<string>('s3Region') ||
      'default'
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

    const fpsRaw = (
      process.env.S3_FORCE_PATH_STYLE ||
      config.get<string>('s3ForcePathStyle') ||
      'true'
    )
      .trim()
      .toLowerCase();
    this.forcePathStyle = fpsRaw !== 'false' && fpsRaw !== '0';

    this.endpointHost = this.safeHost(endpoint);

    if (!endpoint || !accessKeyId || !secretAccessKey || !this.bucket) {
      this.logger.error(
        'S3 config incomplete: need S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET (secrets not logged).',
      );
    }

    // WHEN_REQUIRED: critical for Liara / MinIO / R2 compatibility with SDK ≥ 3.729
    this.client = new S3Client({
      region,
      endpoint: endpoint || undefined,
      forcePathStyle: this.forcePathStyle,
      credentials:
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });

    this.publicBase = (
      process.env.S3_PUBLIC_URL ||
      process.env.STORAGE_PUBLIC_URL ||
      config.get<string>('s3PublicUrl') ||
      ''
    )
      .trim()
      .replace(/\/$/, '');

    if (!this.publicBase) {
      this.logger.error(
        'S3_PUBLIC_URL is required. Use a custom domain bound to the bucket (e.g. https://media.beautijoo.com). ' +
          'Do not use invent *.storage.iran.liara.site URLs — Liara panel subdomains are not for public delivery.',
      );
    } else if (/\.storage\.iran\.liara\.(site|space)$/i.test(this.publicBase.replace(/^https?:\/\//, '').split('/')[0] || '')) {
      this.logger.warn(
        'S3_PUBLIC_URL looks like a Liara default storage host. Liara states those hosts are for panel preview only; ' +
          'bind a real domain (e.g. media.beautijoo.com) to the bucket for production public URLs.',
      );
    }

    this.logger.log(
      `S3 ready bucket=${this.bucket || '(empty)'} endpointHost=${this.endpointHost || '(empty)'} ` +
        `forcePathStyle=${this.forcePathStyle} region=${region} ` +
        `publicBase=${this.publicBase || '(MISSING)'} checksums=WHEN_REQUIRED ` +
        `hasAccessKey=${Boolean(accessKeyId)} hasSecret=${Boolean(secretAccessKey)}`,
    );
  }

  private cleanEndpoint(raw: string): string {
    return raw.trim().replace(/\/+$/, '');
  }

  private safeHost(endpoint: string): string {
    try {
      return endpoint ? new URL(endpoint).host : '';
    } catch {
      return '(invalid-endpoint)';
    }
  }

  /** Extract safe diagnostic fields from AWS SDK errors (never log secrets). */
  private describeError(err: unknown): string {
    if (!err || typeof err !== 'object') return String(err);
    const e = err as Record<string, unknown> & {
      name?: string;
      message?: string;
      Code?: string;
      code?: string;
      $metadata?: { httpStatusCode?: number; requestId?: string };
    };
    const parts = [
      `name=${e.name || e.Code || e.code || 'Error'}`,
      e.$metadata?.httpStatusCode != null ? `status=${e.$metadata.httpStatusCode}` : null,
      e.$metadata?.requestId ? `requestId=${e.$metadata.requestId}` : null,
      e.message ? `msg=${String(e.message).slice(0, 300)}` : null,
    ].filter(Boolean);
    return parts.join(' ');
  }

  async onModuleInit() {
    if (!this.bucket) {
      this.logger.error('S3_BUCKET is empty — uploads will fail.');
      return;
    }
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`S3 HeadBucket OK bucket=${this.bucket}`);
    } catch (err) {
      this.logger.warn(
        `S3 HeadBucket failed (PutObject may still work): ${this.describeError(err)}`,
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
    if (!buffer?.length) {
      throw new InternalServerErrorException('محتوای فایل خالی است.');
    }

    const mime = contentType || 'application/octet-stream';

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: safeKey,
          Body: buffer,
          ContentType: mime,
          ContentLength: buffer.length,
          CacheControl: 'public, max-age=86400',
        }),
      );
      this.logger.log(
        `s3 put OK key=${safeKey} bytes=${buffer.length} type=${mime} bucket=${this.bucket}`,
      );
      return safeKey;
    } catch (err) {
      this.logger.error(
        `s3 put FAILED key=${safeKey} bucket=${this.bucket} endpointHost=${this.endpointHost} ` +
          `forcePathStyle=${this.forcePathStyle} ${this.describeError(err)}`,
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
      this.logger.log(`s3 delete OK key=${safeKey}`);
    } catch (err) {
      this.logger.warn(`s3 delete key=${safeKey}: ${this.describeError(err)}`);
    }
  }

  getPublicUrl(key: string): string {
    const safeKey = key.replace(/^\/+/, '');
    if (!this.publicBase) {
      throw new InternalServerErrorException(
        'S3_PUBLIC_URL تنظیم نشده است. دامنه عمومی متصل به باکت (مثلاً https://media.beautijoo.com) را تنظیم کنید.',
      );
    }
    return `${this.publicBase}/${safeKey}`;
  }

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
