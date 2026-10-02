// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { RESUME_MAX_BYTES } from '../profile/constants/profile.constants';
import { ResumeMetaDto } from './dto/resume-meta.dto';
import { Resume } from './interfaces/resume.interface';
import { ResumesService } from './resumes.service';

@Controller('resumes')
export class ResumesController {
  constructor(private readonly resumes: ResumesService) {}

  @Get()
  list(): Resume[] {
    return this.resumes.list();
  }

  /** A new resume: the PDF as "file", with "label" and "forJobs" (comma-separated) form fields. */
  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: RESUME_MAX_BYTES } }))
  add(@Body() meta: ResumeMetaDto, @UploadedFile() file?: Express.Multer.File): Promise<Resume> {
    if (!file) throw new BadRequestException('Attach the resume PDF as "file"');
    return this.resumes.add(file, meta);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() meta: ResumeMetaDto): Resume {
    return this.resumes.update(id, meta);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number): void {
    this.resumes.remove(id);
  }

  @Get(':id/file')
  file(@Param('id', ParseIntPipe) id: number, @Res() res: Response): void {
    res.sendFile(this.resumes.filePath(id));
  }
}
