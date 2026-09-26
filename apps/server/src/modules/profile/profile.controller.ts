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
import { RESUME_MAX_BYTES } from './constants/profile.constants';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileState } from './interfaces/profile-state.interface';
import { ProfileService } from './profile.service';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  get(): ProfileState {
    return this.profile.state();
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
    res.sendFile(path);
  }
}
