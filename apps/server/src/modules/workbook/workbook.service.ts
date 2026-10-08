// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Readable } from 'node:stream';
import { extname } from 'node:path';
import { BadRequestException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { EventsService } from '../../common/events/events.service';
import { AgentEventType } from '../../common/events/enums/agent-event-type.enum';
import { AnswersService } from '../answers/answers.service';
import { AnswerSource } from '../answers/enums/answer-source.enum';
import { JobsService } from '../jobs/jobs.service';
import { JobStatus } from '../jobs/enums/job-status.enum';
import { ProfileService } from '../profile/profile.service';
import { SettingsService } from '../settings/settings.service';
import {
  SHEET_ANSWERS,
  SHEET_LINKS,
  SHEET_PREFERENCES,
  TEMPLATE_ANSWERS,
  TEMPLATE_LINKS,
  TEMPLATE_PREFERENCES,
  WORKBOOK_MAX_BYTES,
} from './constants/workbook.constants';
import { WorkbookImportResult } from './interfaces/workbook-import.interface';
import { parseWorkbook } from './utils/workbook-parse.util';
import { mapPreferences } from './utils/preference-map.util';
import { validPreferenceRows } from './utils/preference-validate.util';

@Injectable()
export class WorkbookService {
  constructor(
    private readonly answers: AnswersService,
    private readonly jobs: JobsService,
    private readonly settings: SettingsService,
    private readonly profile: ProfileService,
    private readonly events: EventsService,
  ) {}

  async import(file: { buffer: Buffer; originalname: string; size: number }): Promise<WorkbookImportResult> {
    if (file.size > WORKBOOK_MAX_BYTES) throw new BadRequestException('Spreadsheet must be under 5 MB');
    const ext = extname(file.originalname).toLowerCase();
    const wb = new ExcelJS.Workbook();
    try {
      if (ext === '.csv') await wb.csv.read(Readable.from(file.buffer));
      else if (ext === '.xlsx' || ext === '.xlsm') await wb.xlsx.load(file.buffer as unknown as ArrayBuffer);
      else throw new Error('Upload an .xlsx or .csv file (old .xls: re-save as .xlsx)');
    } catch (err) {
      throw new BadRequestException(`Could not read the spreadsheet: ${(err as Error).message}`);
    }

    const parsed = parseWorkbook(wb);
    let answers = 0;
    for (const answer of parsed.answers) if (this.answers.remember(answer.question, answer.answer, AnswerSource.EXCEL)) answers++;
    const links = parsed.links.length ? this.jobs.addLinks(parsed.links) : { added: 0, duplicates: 0, invalid: [] };
    // Same limits as the Settings and Profile pages (e.g. at most 200 applications a day), row by row.
    const checked = validPreferenceRows(parsed.preferences);
    const prefs = mapPreferences(checked.rows);
    prefs.warnings.push(...checked.warnings);
    if (prefs.applied.length) {
      try {
        this.settings.update(prefs.settings);
      } catch (err) {
        // Refused as a whole (e.g. a review score above the apply score): those rows were not applied.
        const settingRows = checked.rows.filter((r) => Object.values(mapPreferences([r]).settings).some((v) => v && Object.keys(v).length));
        prefs.applied = prefs.applied.filter((k) => !settingRows.some((r) => r.key === k));
        prefs.warnings.push(`Settings from the spreadsheet not applied - ${(err as Error).message}`);
      }
      if (Object.keys(prefs.profile).length) this.profile.update(prefs.profile);
    }
    const result: WorkbookImportResult = {
      answers,
      links,
      preferences: prefs.applied,
      warnings: [...parsed.warnings, ...prefs.warnings],
    };
    this.events.emit({
      type: AgentEventType.LOG,
      level: 'success',
      message: `Spreadsheet imported: ${answers} answers, ${links.added} job links queued, ${prefs.applied.length} preferences`,
    });
    return result;
  }

  async template(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Sudarshan AI';
    const answers = wb.addWorksheet(SHEET_ANSWERS);
    answers.columns = [
      { header: 'Question', key: 'q', width: 60 },
      { header: 'Answer', key: 'a', width: 60 },
    ];
    TEMPLATE_ANSWERS.forEach(([q, a]) => answers.addRow({ q, a }));
    const links = wb.addWorksheet(SHEET_LINKS);
    links.columns = [
      { header: 'URL', key: 'u', width: 70 },
      { header: 'Title', key: 't', width: 30 },
      { header: 'Company', key: 'c', width: 25 },
      { header: 'Notes', key: 'n', width: 30 },
    ];
    TEMPLATE_LINKS.forEach(([u, t, c, n]) => links.addRow({ u, t, c, n }));
    const prefs = wb.addWorksheet(SHEET_PREFERENCES);
    prefs.columns = [
      { header: 'Setting', key: 's', width: 28 },
      { header: 'Value', key: 'v', width: 40 },
      { header: 'Help', key: 'h', width: 60 },
    ];
    TEMPLATE_PREFERENCES.forEach(([s, v, h]) => prefs.addRow({ s, v, h }));
    for (const ws of [answers, links, prefs]) {
      ws.getRow(1).font = { bold: true };
      ws.views = [{ state: 'frozen', ySplit: 1 }];
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async export(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Applications');
    ws.columns = [
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Applied at', key: 'appliedAt', width: 20 },
      { header: 'Title', key: 'title', width: 40 },
      { header: 'Company', key: 'company', width: 28 },
      { header: 'Location', key: 'location', width: 24 },
      { header: 'Source', key: 'source', width: 10 },
      { header: 'Score', key: 'score', width: 8 },
      { header: 'Note', key: 'reason', width: 50 },
      { header: 'URL', key: 'url', width: 60 },
    ];
    const statuses = [JobStatus.APPLIED, JobStatus.NEEDS_INPUT, JobStatus.MANUAL, JobStatus.FAILED, JobStatus.APPROVED, JobStatus.REVIEW];
    const { items } = this.jobs.list({ status: statuses, sort: 'recent', limit: 200 });
    let page = 1;
    let batch = items;
    while (batch.length) {
      for (const j of batch) ws.addRow({ ...j, appliedAt: j.appliedAt?.replace('T', ' ').slice(0, 16) ?? '' });
      if (batch.length < 200) break;
      batch = this.jobs.list({ status: statuses, sort: 'recent', limit: 200, page: ++page }).items;
    }
    ws.getRow(1).font = { bold: true };
    ws.autoFilter = { from: 'A1', to: 'I1' };
    return Buffer.from(await wb.xlsx.writeBuffer());
  }
}
