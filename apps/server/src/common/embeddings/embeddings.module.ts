// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Module } from '@nestjs/common';
import { SettingsModule } from '../../modules/settings/settings.module';
import { EmbeddingsService } from './embeddings.service';

/** The local meaning model, shared by answer memory and job ranking. */
@Module({
  imports: [SettingsModule],
  providers: [EmbeddingsService],
  exports: [EmbeddingsService],
})
export class EmbeddingsModule {}
