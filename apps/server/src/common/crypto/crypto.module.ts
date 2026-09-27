// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Global, Module } from '@nestjs/common';
import { SecretBoxService } from './secret-box.service';

@Global()
@Module({
  providers: [SecretBoxService],
  exports: [SecretBoxService],
})
export class CryptoModule {}
