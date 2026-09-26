import { Body, Controller, Get, Patch } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { PublicAppSettings } from './interfaces/app-settings.interface';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  get(): PublicAppSettings {
    return this.settings.getPublic();
  }

  @Patch()
  update(@Body() dto: UpdateSettingsDto): PublicAppSettings {
    return this.settings.update(dto);
  }
}
