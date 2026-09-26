export interface JobStats {
  byStatus: Record<string, number>;
  appliedToday: number;
  appliedTodayBySource: Record<string, number>;
  appliedTotal: number;
  /** Over the last 50 successful applications. */
  medianApplySeconds: number | null;
  /** Share of fields filled without the AI, over the same window. */
  memoryHitRate: number | null;
}
