// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { TasteState } from './interfaces/taste.interface';
import { TasteService } from './taste.service';

@Controller('taste')
export class TasteController {
  constructor(private readonly taste: TasteService) {}

  @Get()
  state(): TasteState {
    return this.taste.state();
  }

  @Post('refresh')
  @HttpCode(200)
  refresh(): TasteState {
    return this.taste.refresh();
  }
}
