import { spawn } from 'node:child_process';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { createStructuredLogger } from './common/logging/structured-logger';
import { configFactory } from './config/configuration';

function openInBrowser(url: string): void {
  const cmd = process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url];
  spawn(cmd, args, { detached: true, stdio: 'ignore' }).on('error', () => undefined).unref();
}

async function bootstrap(): Promise<void> {
  const boot = configFactory();
  const logger = createStructuredLogger(boot.logging.level, boot.paths.logs);
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger });
  const config = app.get(ConfigService);

  process.on('unhandledRejection', (reason) =>
    logger.error(`unhandledRejection: ${reason instanceof Error ? reason.stack : String(reason)}`),
  );

  configureApp(app);
  app.enableShutdownHooks();

  const host = config.get<string>('server.host', '127.0.0.1');
  const port = config.get<number>('server.port', 4747);
  try {
    await app.listen(port, host);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EADDRINUSE') {
      logger.error(`Port ${port} is already in use - is the agent already running? Open http://localhost:${port}, or set SUDARSHAN_PORT.`);
      await app.close();
      process.exit(1);
    }
    throw err;
  }
  const url = `http://localhost:${port}`;
  logger.log(`Sudarshan is running at ${url}  (data: ${boot.paths.dataDir})`);
  if (config.get<boolean>('server.openBrowser') && process.argv.includes('--open')) openInBrowser(url);
}

void bootstrap();
