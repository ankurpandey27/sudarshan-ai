// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

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
