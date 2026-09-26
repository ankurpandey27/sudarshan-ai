import { Controller, Get } from '@nestjs/common';
import { HealthStatus } from './interfaces/health-status.interface';

@Controller('health')
export class HealthController {
  private readonly startedAt = new Date().toISOString();

  @Get()
  health(): HealthStatus {
    return { status: 'ok', version: '2.0.0', startedAt: this.startedAt };
  }
}
