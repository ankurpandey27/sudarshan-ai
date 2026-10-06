// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync, SQLInputValue, StatementSync } from 'node:sqlite';
import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { MIGRATIONS } from './constants/migrations.constants';
import { escapeRegex } from '../utils/regex.util';

export type SqlParams = Record<string, SQLInputValue> | SQLInputValue[];

@Injectable()
export class StorageService implements OnApplicationShutdown {
  private readonly logger = new Logger(StorageService.name);
  private readonly db: DatabaseSync;
  private readonly statements = new Map<string, StatementSync>();

  constructor(file: string) {
    if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    // has_term(text, term): the term as whole words - "Java" is in "Java/J2EE", not in "JavaScript".
    this.db.function('has_term', { deterministic: true }, (text, term) => {
      const wanted = String(term ?? '').trim().toLowerCase();
      return wanted && new RegExp(`(^|[^a-z0-9])${escapeRegex(wanted)}($|[^a-z0-9])`).test(String(text ?? '').toLowerCase()) ? 1 : 0;
    });
    this.migrate();
  }

  run(sql: string, params: SqlParams = []): { changes: number; lastInsertRowid: number } {
    const res = this.bind(sql, params, (s, p) => s.run(...p));
    return { changes: Number(res.changes), lastInsertRowid: Number(res.lastInsertRowid) };
  }

  get<T>(sql: string, params: SqlParams = []): T | undefined {
    return this.bind(sql, params, (s, p) => s.get(...p)) as T | undefined;
  }

  all<T>(sql: string, params: SqlParams = []): T[] {
    return this.bind(sql, params, (s, p) => s.all(...p)) as T[];
  }

  /** Runs fn atomically; nested calls join the outer transaction. */
  transaction<T>(fn: () => T): T {
    if (this.db.isTransaction) return fn();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const out = fn();
      this.db.exec('COMMIT');
      return out;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  onApplicationShutdown(): void {
    if (this.db.isOpen) this.db.close();
  }

  private bind<R>(sql: string, params: SqlParams, exec: (s: StatementSync, p: SQLInputValue[]) => R): R {
    let stmt = this.statements.get(sql);
    if (!stmt) {
      stmt = this.db.prepare(sql);
      this.statements.set(sql, stmt);
    }
    if (Array.isArray(params)) return exec(stmt, params);
    // Named parameters: node:sqlite takes one object as the first argument.
    return exec(stmt, [params as unknown as SQLInputValue]);
  }

  private migrate(): void {
    const { user_version: current } = this.db.prepare('PRAGMA user_version').get() as { user_version: number };
    for (let version = current; version < MIGRATIONS.length; version++) {
      this.db.exec('BEGIN');
      try {
        this.db.exec(MIGRATIONS[version]);
        this.db.exec(`PRAGMA user_version = ${version + 1}`);
        this.db.exec('COMMIT');
        this.logger.log(`Database migrated to v${version + 1}`);
      } catch (err) {
        this.db.exec('ROLLBACK');
        throw err;
      }
    }
  }
}
