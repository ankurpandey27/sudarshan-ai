// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { sendDataFile } from '../../common/utils/send-data-file.util';
import { RESUME_MAX_BYTES } from './constants/profile.constants';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileState } from './interfaces/profile-state.interface';
import { ProfileService } from './profile.service';
import { ProfileCheckService } from './profile-check.service';
import { ProfileCheck } from './interfaces/profile-check.interface';

@Controller('profile')
export class ProfileController {
  constructor(
    private readonly profile: ProfileService,
    private readonly checker: ProfileCheckService,
  ) {}

  @Get()
  get(): ProfileState {
    return this.profile.state();
  }

  /** What would make your profile match more of the jobs found: skills to add, and short tips. */
  @Get('check')
  check(): ProfileCheck {
    return this.checker.check();
  }

  @Patch()
  update(@Body() dto: UpdateProfileDto): ProfileState {
    return this.profile.update(dto);
  }

  @Post('resume')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: RESUME_MAX_BYTES } }))
  uploadResume(@UploadedFile() file?: Express.Multer.File): Promise<ProfileState> {
    if (!file) throw new BadRequestException('Attach the resume PDF as "file"');
    return this.profile.importResume(file);
  }

  @Get('resume/file')
  downloadResume(@Res() res: Response): void {
    const path = this.profile.resumePath();
    if (!path) throw new NotFoundException('No resume uploaded yet');
    sendDataFile(res, path);
  }
}
