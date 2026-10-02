// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { IsEmail, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class ConnectInboxDto {
  @IsEmail()
  @MaxLength(200)
  user!: string;

  /** An app password from your mail provider (not your normal password). */
  @IsString()
  @MinLength(4)
  @MaxLength(200)
  password!: string;

  /** The IMAP server; found by itself for Gmail, Yahoo, iCloud, Zoho and Fastmail. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  host?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;
}
