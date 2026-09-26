import { Controller, Get, HttpCode, Param, ParseIntPipe, Post, ServiceUnavailableException } from '@nestjs/common';
import { ApplyResult } from '../apply/interfaces/apply-adapter.interface';
import { BrowserUnavailableError } from '../browser/errors/browser-unavailable.error';
import { AgentService } from './agent.service';
import { AgentStatus } from './interfaces/agent-status.interface';
import { Insight } from './interfaces/insight.interface';
import { InsightsService } from './insights.service';

@Controller('agent')
export class AgentController {
  constructor(
    private readonly agent: AgentService,
    private readonly insights: InsightsService,
  ) {}

  @Get('insights')
  insightList(): Promise<Insight[]> {
    return this.insights.list();
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
  async rescore(): Promise<{ rescored: number }> {
    return { rescored: await this.agent.rescore() };
  }

  @Post('apply/:id')
  @HttpCode(200)
  applyNow(@Param('id', ParseIntPipe) id: number): Promise<ApplyResult> {
    return this.agent.applyNow(id);
  }
}
