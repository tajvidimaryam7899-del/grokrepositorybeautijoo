import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ThrottlerStorage, getStorageToken } from '@nestjs/throttler';
import { AppModule } from '../../src/app.module';
import { AllExceptionsFilter } from '../../src/common/filters/http-exception.filter';

/** Always-allow storage so e2e is not blocked by rate limits. Test-only. */
class AllowAllThrottlerStorage {
  async increment(
    _key: string,
    _ttl: number,
    _limit: number,
    _blockDuration: number,
    _throttlerName: string,
  ) {
    return {
      totalHits: 1,
      timeToExpire: 60,
      isBlocked: false,
      timeToBlockExpire: 0,
    };
  }
}

export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(getStorageToken())
    .useClass(AllowAllThrottlerStorage)
    .overrideProvider(ThrottlerStorage)
    .useClass(AllowAllThrottlerStorage)
    .compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.init();
  return app;
}
