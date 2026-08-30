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
 * Official Liara Node/Next sample (docs.liara.ir):
 *   endpoint: from console "دسترسی با SDK" (e.g. https://storage.iran.liara.site)
 *   region: "default"
 *   forcePathStyle: true
 *   credentials: Access Key + Secret Key of the bucket
 *
 * AWS SDK JS v3 (≥ ~3.729) sends flexible checksum headers by default;
 * Liara rejects them. We force requestChecksumCalculation /
 * responseChecksumValidation to WHEN_REQUIRED and never invent public hosts.
 *
 * Required env (set only in Liara panel — never commit secrets):
 *   STORAGE_PROVIDER=s3
 *   S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET, S3_PUBLIC_URL
 *
 * S3_PUBLIC_URL must be a real public base after binding a domain to the bucket
 * (e.g. https://media.beautijoo.com). Do not use *.storage.iran.liara.site —
 * Liara documents those hosts as panel preview only, not public delivery.
 */
@Injectable()
export class S3StorageProvider implements StorageProvider, OnModuleInit {
  private readonly logger = new Logger(S3StorageProvider.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBase: string;
  private readonly forcePathStyle: boolean;
  private readonly endpointHost: string;
  private readonly region: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.cleanEndpoint(
      process.env.S3_ENDPOINT || config.get<string>('s3Endpoint') || '',
    );
    this.region = (
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
      String(config.get('s3ForcePathStyle') ?? 'true') ||
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

    // Match official Liara sample + disable flexible checksums (Liara rejects them).
    this.client = new S3Client({
      region: this.region,
      endpoint: endpoint || undefined,
      forcePathStyle: this.forcePathStyle,
      credentials:
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });

    this.stripChecksumMiddleware(this.client);

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
        'S3_PUBLIC_URL is required. Bind a custom domain to the bucket (e.g. media.beautijoo.com) then set S3_PUBLIC_URL=https://media.beautijoo.com. ' +
          'Do not invent *.storage.iran.liara.site URLs.',
      );
    } else if (
      /\.storage\.iran\.liara\.(site|space)$/i.test(
        this.publicBase.replace(/^https?:\/\//, '').split('/')[0] || '',
      )
    ) {
      this.logger.warn(
        'S3_PUBLIC_URL looks like a Liara default storage host. Liara states those hosts are for panel preview only; ' +
          'bind a real domain (e.g. media.beautijoo.com) to the bucket for production public URLs.',
      );
    }

    this.logger.log(
      `S3 ready bucket=${this.bucket || '(empty)'} endpointHost=${this.endpointHost || '(empty)'} ` +
        `forcePathStyle=${this.forcePathStyle} region=${this.region} ` +
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

  /** Best-effort removal of flexible checksum middleware (name varies by SDK version). */
  private stripChecksumMiddleware(client: S3Client): void {
    try {
      const stack = (client as unknown as { middlewareStack?: { remove?: (n: string) => void } })
        .middlewareStack;
      if (!stack?.remove) return;
      for (const name of ['flexibleChecksumsMiddleware', 'flexibleChecksums']) {
        try {
          stack.remove(name);
        } catch {
          /* middleware may not exist in this build */
        }
      }
    } catch {
      /* ignore */
    }
  }

  /** Safe diagnostic fields only — never log secrets or full request bodies. */
  private describeError(err: unknown): string {
    if (!err || typeof err !== 'object') return String(err);
    const e = err as Record<string, unknown> & {
      name?: string;
      message?: string;
      Code?: string;
      code?: string;
      $metadata?: { httpStatusCode?: number; requestId?: string };
      $response?: { statusCode?: number };
    };
    const code = e.Code || e.code || e.name || 'Error';
    const status =
      e.$metadata?.httpStatusCode ?? e.$response?.statusCode ?? undefined;
    const requestId = e.$metadata?.requestId;
    const msg = e.message ? String(e.message).slice(0, 400) : '';
    const scrubbed = msg
      .replace(/AKIA[0-9A-Z]{16}/gi, '[REDACTED]')
      .replace(/secret[^,\s]*/gi, 'secret=[REDACTED]')
      .replace(/Credential=[^,\s/]+/gi, 'Credential=[REDACTED]');
    const parts = [
      `name=${code}`,
      status != null ? `status=${status}` : null,
      requestId ? `requestId=${requestId}` : null,
      scrubbed ? `msg=${scrubbed}` : null,
    ].filter(Boolean);
    return parts.join(' ');
  }

  private userMessageForError(err: unknown): string {
    if (!err || typeof err !== 'object') {
      return 'ذخیره‌سازی فایل در Object Storage ناموفق بود. تنظیمات S3 را بررسی کنید.';
    }
    const e = err as Record<string, unknown> & {
      name?: string;
      Code?: string;
      code?: string;
      message?: string;
    };
    const code = String(e.Code || e.code || e.name || '').toLowerCase();
    const msg = String(e.message || '').toLowerCase();

    if (
      code.includes('signaturedoesnotmatch') ||
      msg.includes('signature does not match')
    ) {
      return 'احراز هویت S3 ناموفق بود (SignatureDoesNotMatch). Access Key و Secret Key و Endpoint را در پنل Liara بررسی کنید.';
    }
    if (code.includes('accessdenied') || msg.includes('access denied')) {
      return 'دسترسی به باکت رد شد (AccessDenied). مجوزهای کلید (PUT/READ/DELETE) و نام باکت را بررسی کنید.';
    }
    if (code.includes('nosuchbucket') || msg.includes('no such bucket')) {
      return 'باکت یافت نشد (NoSuchBucket). نام S3_BUCKET را با نام باکت در پنل Liara یکسان کنید.';
    }
    if (
      code.includes('invalidaccesskeyid') ||
      msg.includes('invalid access key')
    ) {
      return 'Access Key نامعتبر است. کلید جدید از پنل Object Storage بسازید و در متغیرهای محیطی ست کنید.';
    }
    if (
      code.includes('permanentredirect') ||
      code.includes('authorizationheadermalformed') ||
      (msg.includes('endpoint') && msg.includes('region'))
    ) {
      return 'Endpoint یا Region نادرست است. مقدار رسمی از بخش «دسترسی با SDK» پنل Liara را برای S3_ENDPOINT استفاده کنید (معمولاً https://storage.iran.liara.site).';
    }
    if (
      code.includes('xamzcontentsha256mismatch') ||
      code.includes('baddigest') ||
      msg.includes('checksum') ||
      msg.includes('content-md5')
    ) {
      return 'خطای checksum/digest با Object Storage. نسخهٔ کلاینت S3 را بررسی کنید.';
    }
    if (
      code.includes('networkingerror') ||
      msg.includes('econnrefused') ||
      msg.includes('enotfound')
    ) {
      return 'اتصال به Endpoint فضای ذخیره‌سازی برقرار نشد. S3_ENDPOINT و شبکهٔ سرور را بررسی کنید.';
    }
    return 'ذخیره‌سازی فایل در Object Storage ناموفق بود. تنظیمات S3 را بررسی کنید.';
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
    // Official Liara sample uses Body: buffer without ContentLength.
    const body = Uint8Array.from(buffer);

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: safeKey,
          Body: body,
          ContentType: mime,
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
          `region=${this.region} forcePathStyle=${this.forcePathStyle} ${this.describeError(err)}`,
      );
      throw new InternalServerErrorException(this.userMessageForError(err));
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
