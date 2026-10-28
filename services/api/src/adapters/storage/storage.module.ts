import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, type AppConfig } from '../../config/app-config.js';
import { OBJECT_STORAGE, type ObjectStorage } from '../../ports/object-storage.port.js';
import { InMemoryObjectStorage } from './in-memory-object-storage.js';
import { S3ObjectStorage } from './s3-object-storage.js';

function objectStorage(config: AppConfig): ObjectStorage {
  if (config.STORAGE_DRIVER === 'memory') return new InMemoryObjectStorage();
  return new S3ObjectStorage({
    endpoint: config.S3_ENDPOINT!,
    region: config.S3_REGION,
    accessKeyId: config.S3_ACCESS_KEY!,
    secretAccessKey: config.S3_SECRET_KEY!,
    bucket: config.S3_BUCKET,
    forcePathStyle: config.S3_FORCE_PATH_STYLE,
  });
}

@Global()
@Module({
  providers: [{ provide: OBJECT_STORAGE, useFactory: objectStorage, inject: [APP_CONFIG] }],
  exports: [OBJECT_STORAGE],
})
export class StorageModule {}
