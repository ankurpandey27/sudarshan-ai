import TransportStream from 'winston-transport';
import * as fs from 'fs';
import * as path from 'path';
import { localDay } from '../../utils/date.util';
import { LogRecord } from '../interfaces/log-record.interface';

/** One JSON log file per local day. */
export class DailyJsonTransport extends TransportStream {
  private currentDay: string;
  private stream: fs.WriteStream;

  constructor(
    private readonly dir: string,
    private readonly filenamePrefix = 'agent',
  ) {
    super();
    this.currentDay = localDay();
    fs.mkdirSync(dir, { recursive: true });
    this.stream = fs.createWriteStream(
      path.join(dir, `${filenamePrefix}-${this.currentDay}.json`),
      { flags: 'a' },
    );
  }

  log(info: LogRecord, callback: () => void): void {
    const day = localDay();
    if (day !== this.currentDay) {
      this.stream.end();
      this.currentDay = day;
      this.stream = fs.createWriteStream(
        path.join(this.dir, `${this.filenamePrefix}-${day}.json`),
        { flags: 'a' },
      );
    }
    this.stream.write(JSON.stringify(info) + '\n');
    callback();
  }
}
