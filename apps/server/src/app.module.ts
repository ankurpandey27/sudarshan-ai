// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { configFactory } from './config/configuration';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { LocalOriginGuard } from './common/security/guards/local-origin.guard';
import { StorageModule } from './common/storage/storage.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { EventsModule } from './common/events/events.module';
import { SettingsModule } from './modules/settings/settings.module';
import { LlmModule } from './modules/llm/llm.module';
import { ProfileModule } from './modules/profile/profile.module';
import { HousekeepingModule } from './modules/housekeeping/housekeeping.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AnswersModule } from './modules/answers/answers.module';
import { BrowserModule } from './modules/browser/browser.module';
import { FormEngineModule } from './modules/form-engine/form-engine.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';
import { ScoringModule } from './modules/scoring/scoring.module';
import { ApplyModule } from './modules/apply/apply.module';
import { AgentModule } from './modules/agent/agent.module';
import { WorkbookModule } from './modules/workbook/workbook.module';
import { HealthModule } from './modules/health/health.module';
import { TasteModule } from './modules/taste/taste.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configFactory], cache: true, ignoreEnvFile: true }),
    StorageModule,
    CryptoModule,
    EventsModule,
    SettingsModule,
    LlmModule,
    ProfileModule,
    HousekeepingModule,
    TasteModule,
    JobsModule,
    AnalyticsModule,
    AnswersModule,
    BrowserModule,
    FormEngineModule,
    DiscoveryModule,
    ScoringModule,
    ApplyModule,
    AgentModule,
    WorkbookModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: LocalOriginGuard },
    { provide: APP_INTERCEPTOR, useClass: ResponseEnvelopeInterceptor },
  ],
})
export class AppModule {}
