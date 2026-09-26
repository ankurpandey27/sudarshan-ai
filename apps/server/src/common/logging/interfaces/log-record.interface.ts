export interface LogContext {
  agentId?: string;
  jobId?: string;
  platform?: string;
  company?: string;
  jobTitle?: string;
  action?: string;
  [key: string]: unknown;
}

export interface MetricsPayload {
  duration_ms?: number;
  memory_mb?: number;
  technicalScore?: number;
  salaryScore?: number;
  overallScore?: number;
  decision?: string;
  [key: string]: unknown;
}

export interface LogRecord {
  timestamp: string;
  level: string;
  message: string;
  context?: LogContext;
  tracing?: { traceId: string; requestId: string };
  metrics?: MetricsPayload | null;
  error?: unknown;
}
