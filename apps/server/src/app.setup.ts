import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { ApiErrorFilter } from './common/filters/api-error.filter';
import { requestContextMiddleware } from './common/middleware/request-context.middleware';

export function configureApp(app: NestExpressApplication): string {
  const config = app.get(ConfigService);
  const apiPrefix = config.get<string>('server.apiPrefix', 'api');
  app.setGlobalPrefix(apiPrefix);
  app.use(requestContextMiddleware);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.useBodyParser('json', { limit: '2mb' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new ApiErrorFilter());

  const webDist = config.getOrThrow<string>('paths.webDist');
  if (existsSync(join(webDist, 'index.html'))) {
    app.useStaticAssets(webDist, { index: false, maxAge: '1h' });
    // SPA fallback for client-side routes.
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (req.method !== 'GET' || req.path.startsWith(`/${apiPrefix}`)) return next();
      res.sendFile(join(webDist, 'index.html'));
    });
  }
  return apiPrefix;
}
