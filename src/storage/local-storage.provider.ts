import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageProvider } from './storage.provider';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class LocalStorageProvider implements StorageProvider {
  private readonly logger = new Logger(LocalStorageProvider.name);
  private readonly basePath: string;

  constructor(private readonly config: ConfigService) {
    this.basePath = config.get<string>('storageLocalPath') || './uploads';
  }

  async upload(key: string, buffer: Buffer, contentType: string): Promise<string> {
    const full = path.join(this.basePath, key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, buffer);
    this.logger.debug(`stored ${key} (${contentType})`);
    return key;
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(path.join(this.basePath, key));
    } catch {
      /* ignore */
    }
  }

  getPublicUrl(key: string): string {
    return `/uploads/${key}`;
  }
}
