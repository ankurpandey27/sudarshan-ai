export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export const jitter = (minMs: number, maxMs: number): Promise<void> =>
  sleep(Math.round(minMs + Math.random() * Math.max(0, maxMs - minMs)));
