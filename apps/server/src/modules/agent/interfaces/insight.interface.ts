export type InsightSeverity = 'error' | 'warn' | 'info';

export interface InsightAction {
  label: string;
  to?: string;
  api?: string;
}

export interface Insight {
  id: string;
  severity: InsightSeverity;
  title: string;
  detail: string;
  fix: string;
  actions: InsightAction[];
}
