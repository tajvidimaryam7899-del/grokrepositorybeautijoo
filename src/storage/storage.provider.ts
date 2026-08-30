export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';

/**
 * Abstraction over local disk or S3-compatible object storage (e.g. Liara Object Storage).
 * File bytes live in the provider; PostgreSQL only stores metadata + publicUrl.
 */
export interface StorageProvider {
  /** Persist bytes under key; returns the storage key. */
  upload(key: string, buffer: Buffer, contentType: string): Promise<string>;
  /** Best-effort delete; missing keys are ignored. */
  delete(key: string): Promise<void>;
  /** Absolute or origin-relative URL the frontend can load. */
  getPublicUrl(key: string): string;
}
