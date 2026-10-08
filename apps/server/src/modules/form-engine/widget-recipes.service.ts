// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Injectable } from '@nestjs/common';
import { StorageService } from '../../common/storage/storage.service';
import { GLOBAL_RECIPE_MARGIN } from './constants/fill-check.constants';
import { FillMethod } from './enums/fill-method.enum';

/**
 * How to operate each kind of field, learned from what actually worked: "on indeed.com, a button that
 * opens a listbox: click it open, then click the option". Kept per site, and shared across sites once a
 * method has proved itself on several, so a new site with the same widget needs no trial and no AI.
 */
@Injectable()
export class WidgetRecipesService {
  constructor(private readonly storage: StorageService) {}

  /** The method that works for this widget on this site - or, failing that, on other sites. */
  best(domain: string, widget: string): FillMethod | null {
    const here = this.storage.get<{ method: string }>(
      'SELECT method FROM widget_recipes WHERE domain = ? AND widget = ? AND ok > fail ORDER BY ok - fail DESC, at DESC LIMIT 1',
      [domain, widget],
    );
    if (here) return here.method as FillMethod;
    const anywhere = this.storage.get<{ method: string }>(
      'SELECT method FROM widget_recipes WHERE widget = ? GROUP BY method HAVING SUM(ok) - SUM(fail) >= ? ORDER BY SUM(ok) - SUM(fail) DESC LIMIT 1',
      [widget, GLOBAL_RECIPE_MARGIN],
    );
    return (anywhere?.method as FillMethod | undefined) ?? null;
  }

  /** Some way of operating this widget is known to work on this site. */
  worksHere(domain: string, widget: string): boolean {
    return !!this.storage.get('SELECT 1 FROM widget_recipes WHERE domain = ? AND widget = ? AND ok > fail LIMIT 1', [domain, widget]);
  }

  record(domain: string, widget: string, method: FillMethod, worked: boolean): void {
    this.storage.run(
      `INSERT INTO widget_recipes (domain, widget, method, ok, fail, at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(domain, widget, method) DO UPDATE SET ok = ok + excluded.ok, fail = fail + excluded.fail, at = excluded.at`,
      [domain, widget, method, worked ? 1 : 0, worked ? 0 : 1, new Date().toISOString()],
    );
  }

  /** How many widget kinds Sudarshan AI knows how to operate, for the learning card. */
  count(): number {
    return Number(this.storage.get<{ n: number }>('SELECT COUNT(DISTINCT widget) n FROM widget_recipes WHERE ok > fail')?.n ?? 0);
  }
}
