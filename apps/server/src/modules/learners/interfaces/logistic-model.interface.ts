// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

export interface LogisticModel {
  weights: Record<string, number>;
  bias: number;
}

export interface LogisticSample {
  x: Record<string, number>;
  y: 0 | 1;
}
