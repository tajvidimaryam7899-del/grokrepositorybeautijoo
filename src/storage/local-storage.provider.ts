import { Injectable, Logger, OnModuleInit, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageProvider } from './storage.provider';
import * as fs from 'fs/promises';
import * as path from 'path';
import { existsSync, mkdirSync } from 'fs';

@Injectable()
export class LocalStorageProvider implements StorageProvider, OnModuleInit {
  private readonly logger = new Logger(LocalStorageProvider.name);
  private readonly basePath: string;
  private readonly publicBase: string;

  constructor(private readonly config: ConfigService) {
    const configured = config.get<string>('storageLocalPath') || process.env.STORAGE_LOCAL_PATH || './uploads';
    this.basePath = path.isAbsolute(configured)
      ? configured
      : path.resolve(process.cwd(), configured);

    this.publicBase = (
      process.env.PUBLIC_API_URL ||
      process.env.API_PUBLIC_URL ||
      ''
    )
      .trim()
      .replace(/\/$/, '')
      .replace(/\/api\/v1$/i, '');
  }

  async onModuleInit() {
    try {
      if (!existsSync(this.basePath)) {
        mkdirSync(this.basePath, { recursive: true });
      }
      const probe = path.join(this.basePath, '.write-probe');
      await fs.writeFile(probe, 'ok');
      await fs.unlink(probe).catch(() => undefined);
      this.logger.log(`Local storage ready at ${this.basePath} publicBase=${this.publicBase || '(relative)'}`);
    } catch (err) {
      this.logger.error(
        `Cannot write to storage path ${this.basePath}: ${(err as Error).message}. ` +
          'On Liara attach a persistent disk and set STORAGE_LOCAL_PATH to the mount point.',
      );
    }
  }

  async upload(key: string, buffer: Buffer, contentType: string): Promise<string> {
    const full = path.join(this.basePath, key);
    try {
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, buffer);
      this.logger.log(`stored key=${key} bytes=${buffer.length} type=${contentType}`);
      return key;
    } catch (err) {
      this.logger.error(`storage write failed key=${key}: ${(err as Error).message}`);
      throw new InternalServerErrorException(
        'ذخیره‌سازی فایل ناموفق بود. فضای دیسک یا دسترسی نوشتن را بررسی کنید.',
      );
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(path.join(this.basePath, key));
    } catch {
      /* ignore missing files */
    }
  }

  getPublicUrl(key: string): string {
    const rel = `/uploads/${key}`;
    if (this.publicBase) return `${this.publicBase}${rel}`;
    return rel;
  }
}
