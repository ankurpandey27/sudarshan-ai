// "Today" means the user's local day, not the UTC day.

const pad = (n: number): string => String(n).padStart(2, '0');

export const localDay = (at: Date = new Date()): string =>
  `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;

export const localDayStartIso = (at: Date = new Date()): string => {
  const start = new Date(at);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
};
