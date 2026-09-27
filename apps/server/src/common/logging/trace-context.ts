// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { AsyncLocalStorage } from 'async_hooks';
import { TraceContextData } from './interfaces/trace-context.interface';

class TraceContextImpl {
  private readonly store = new AsyncLocalStorage<TraceContextData>();

  run<T>(data: TraceContextData, fn: () => T): T {
    return this.store.run(data, fn);
  }

  current(): TraceContextData | undefined {
    return this.store.getStore();
  }

  requestId(): string {
    return this.store.getStore()?.requestId ?? '';
  }

  path(): string {
    return this.store.getStore()?.path ?? '';
  }
}

export const TraceContext = new TraceContextImpl();