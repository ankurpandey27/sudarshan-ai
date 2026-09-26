import { BadRequestException, Controller, Get, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { WORKBOOK_MAX_BYTES } from './constants/workbook.constants';
import { WorkbookImportResult } from './interfaces/workbook-import.interface';
import { WorkbookService } from './workbook.service';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@Controller('workbook')
export class WorkbookController {
  constructor(private readonly workbook: WorkbookService) {}

  @Post('import')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: WORKBOOK_MAX_BYTES } }))
  import(@UploadedFile() file?: Express.Multer.File): Promise<WorkbookImportResult> {
    if (!file) throw new BadRequestException('Attach the spreadsheet as "file"');
    return this.workbook.import(file);
  }

  @Get('template/file')
  async template(@Res() res: Response): Promise<void> {
    res.setHeader('content-type', XLSX);
    res.setHeader('content-disposition', 'attachment; filename="sudarshan-template.xlsx"');
    res.send(await this.workbook.template());
  }

  @Get('export/file')
  async export(@Res() res: Response): Promise<void> {
    res.setHeader('content-type', XLSX);
    res.setHeader('content-disposition', `attachment; filename="applications-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    res.send(await this.workbook.export());
  }
}
