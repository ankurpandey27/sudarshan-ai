// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateIf, ValidateNested } from 'class-validator';
import { ProfileEducationDto } from './profile-education.dto';
import { ProfileExperienceDto } from './profile-experience.dto';
import { ProfileSkillDto } from './profile-skill.dto';

export class UpdateProfileDto {
  @IsOptional() @IsString() @MaxLength(80) firstName?: string;
  @IsOptional() @IsString() @MaxLength(80) lastName?: string;
  @IsOptional() @IsString() @MaxLength(200) email?: string;
  @IsOptional() @IsString() @MaxLength(20) phone?: string;
  @IsOptional() @IsString() @MaxLength(6) phoneCountryCode?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(80) state?: string;
  @IsOptional() @IsString() @MaxLength(80) country?: string;
  @IsOptional() @IsString() @MaxLength(12) postalCode?: string;
  @IsOptional() @IsString() @MaxLength(200) headline?: string;
  @IsOptional() @IsString() @MaxLength(120) currentTitle?: string;
  @IsOptional() @IsString() @MaxLength(120) currentCompany?: string;

  @IsOptional() @IsNumber() @Min(0) @Max(50) totalYearsExperience?: number;

  @IsOptional() @ValidateIf((_, v) => v !== null) @IsNumber() @Min(0) @Max(365) noticePeriodDays?: number | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsNumber() @Min(0) currentCtc?: number | null;
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsNumber() @Min(0) expectedCtc?: number | null;
  @IsOptional() @IsString() @MaxLength(5) currency?: string;

  @IsOptional() @IsBoolean() willingToRelocate?: boolean;
  @IsOptional() @IsBoolean() cleanRecord?: boolean;
  @IsOptional() @IsBoolean() remotePreferred?: boolean;
  @IsOptional() @IsString() @MaxLength(200) workAuthorization?: string;
  @IsOptional() @IsBoolean() needsSponsorship?: boolean;

  @IsOptional() @IsString() @MaxLength(300) linkedinUrl?: string;
  @IsOptional() @IsString() @MaxLength(300) githubUrl?: string;
  @IsOptional() @IsString() @MaxLength(300) portfolioUrl?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => ProfileSkillDto)
  skills?: ProfileSkillDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => ProfileEducationDto)
  education?: ProfileEducationDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ProfileExperienceDto)
  experience?: ProfileExperienceDto[];

  @IsOptional() @IsArray() @IsString({ each: true }) languages?: string[];
  @IsOptional() @IsString() @MaxLength(3000) summary?: string;
  @IsOptional() @IsString() @MaxLength(40) gender?: string;
  @IsOptional() @IsString() @MaxLength(20) dateOfBirth?: string;
}
