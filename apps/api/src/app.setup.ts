import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { Env } from './config/env';

/**
 * Everything the HTTP layer needs besides the module graph: security headers, CORS,
 * the /api/v1 prefix, DTO validation and the error shape. Shared by main.ts and the
 * integration tests so they exercise exactly the same pipeline.
 */
export function configureApp(app: INestApplication): INestApplication {
  const config = app.get(ConfigService<Env, true>);

  app.use(helmet());
  app.enableCors({
    origin: config
      .get('CORS_ORIGINS', { infer: true })
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    allowedHeaders: ['Content-Type', 'Idempotency-Key'],
    methods: ['GET', 'POST', 'OPTIONS'],
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  return app;
}
