import { Body, Controller, Get, HttpCode, Post, ServiceUnavailableException } from '@nestjs/common';
import { BrowserService } from './browser.service';
import { OpenLoginDto } from './dto/open-login.dto';
import { OpenUrlDto } from './dto/open-url.dto';
import { BrowserUnavailableError } from './errors/browser-unavailable.error';
import { BrowserStatus } from './interfaces/site-session.interface';

@Controller('browser')
export class BrowserController {
  constructor(private readonly browser: BrowserService) {}

  @Get('status')
  status(): Promise<BrowserStatus> {
    return this.browser.status();
  }

  @Post('start')
  @HttpCode(200)
  async start(): Promise<BrowserStatus> {
    await this.guard(() => this.browser.ensure());
    return this.browser.status();
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: OpenLoginDto): Promise<{ opened: true }> {
    await this.guard(() => this.browser.openLogin(dto.site));
    return { opened: true };
  }

  @Post('open')
  @HttpCode(200)
  async open(@Body() dto: OpenUrlDto): Promise<{ opened: true }> {
    await this.guard(() => this.browser.openForUser(dto.url));
    return { opened: true };
  }

  @Post('close')
  @HttpCode(200)
  async close(): Promise<{ closed: true }> {
    await this.browser.close();
    return { closed: true };
  }

  private async guard(fn: () => Promise<unknown>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      if (err instanceof BrowserUnavailableError) throw new ServiceUnavailableException(err.message);
      throw err;
    }
  }
}
