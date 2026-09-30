// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, ServiceUnavailableException, ParseEnumPipe } from '@nestjs/common';
import { ApplyResult } from '../apply/interfaces/apply-adapter.interface';
import { ApplyService } from '../apply/apply.service';
import { BrowserUnavailableError } from '../browser/errors/browser-unavailable.error';
import { AgentService } from './agent.service';
import { AgentStatus } from './interfaces/agent-status.interface';
import { Insight } from './interfaces/insight.interface';
import { DismissInsightDto } from './dto/dismiss-insight.dto';
import { InsightsService } from './insights.service';
import { PlatformHealthService } from '../platform-health/platform-health.service';
import { PlatformHealth } from '../platform-health/interfaces/platform-health.interface';
import { JobPlatform } from '../jobs/enums/job-platform.enum';
import { RescueService } from '../form-engine/rescue.service';

@Controller('agent')
export class AgentController {
  constructor(
    private readonly agent: AgentService,
    private readonly insights: InsightsService,
    private readonly health: PlatformHealthService,
    private readonly rescue: RescueService,
    private readonly apply: ApplyService,
  ) {}

  @Get('insights')
  insightList(): Promise<Insight[]> {
    return this.insights.list();
  }

  /** Hides a "Needs attention" card until the situation changes (it then comes back). */
  @Post('insights/:id/dismiss')
  @HttpCode(200)
  dismissInsight(@Param('id') id: string, @Body() dto: DismissInsightDto): { dismissed: true } {
    this.insights.dismiss(id, dto.version);
    return { dismissed: true };
  }

  @Get('status')
  status(): AgentStatus {
    return this.agent.status();
  }

  @Post('start')
  @HttpCode(200)
  async start(): Promise<AgentStatus> {
    try {
      return await this.agent.start();
    } catch (err) {
      if (err instanceof BrowserUnavailableError) throw new ServiceUnavailableException(err.message);
      throw err;
    }
  }

  @Post('stop')
  @HttpCode(200)
  stop(): AgentStatus {
    return this.agent.stop();
  }

  // Runs in the background; progress arrives on the event stream.
  @Post('discover')
  @HttpCode(202)
  discover(): { started: true } {
    void this.agent.discoverNow();
    return { started: true };
  }

  @Post('rescore')
  @HttpCode(200)
  rescore(): { rescored: number } {
    return { rescored: this.agent.rescore() };
  }

  @Post('score-new')
  @HttpCode(200)
  scoreNew(): { rescored: number } {
    return { rescored: this.agent.scoreUnscored() };
  }

  /** Resume a platform that was paused because its pages seemed to change; it stops before Submit until one works. */
  /** Jobs whose tab is still open for you, so Sudarshan can carry on in them. */
  @Get('open-tabs')
  openTabs(): number[] {
    return this.apply.openTabs();
  }

  /** You unblocked a job handed over to you (a captcha, a login): carry on from where its tab is. */
  @Post('continue/:id')
  @HttpCode(200)
  continueJob(@Param('id', ParseIntPipe) id: number): Promise<ApplyResult> {
    return this.agent.continueNow(id);
  }

  /** Rescues paused after failing again and again with this AI model: try them again. */
  @Post('rescue/retry')
  @HttpCode(200)
  retryRescue(): { ok: true } {
    this.rescue.resume();
    return { ok: true };
  }

  @Post('platforms/:platform/retry')
  @HttpCode(200)
  retryPlatform(@Param('platform', new ParseEnumPipe(JobPlatform)) platform: JobPlatform): PlatformHealth {
    return this.health.retry(platform);
  }

  @Post('apply/:id')
  @HttpCode(200)
  applyNow(@Param('id', ParseIntPipe) id: number): Promise<ApplyResult> {
    return this.agent.applyNow(id);
  }
}
