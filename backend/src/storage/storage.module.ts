import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { STORAGE_PROVIDER } from './storage.provider';
import { LocalStorageProvider } from './local-storage.provider';

@Global()
@Module({
  providers: [
    {
      provide: STORAGE_PROVIDER,
      useFactory: (config: ConfigService) => new LocalStorageProvider(config),
      inject: [ConfigService],
    },
    LocalStorageProvider,
  ],
  exports: [STORAGE_PROVIDER],
})
export class StorageModule {}
