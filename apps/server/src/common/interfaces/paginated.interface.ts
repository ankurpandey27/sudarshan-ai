// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
