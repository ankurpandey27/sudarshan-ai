import { AgentPhase } from '../enums/agent-phase.enum';

export interface AgentStatus {
  running: boolean;
  phase: AgentPhase;
  currentJob: { id: number; title: string; company: string } | null;
  nextDiscoveryAt: string | null;
  nextApplyAt: string | null;
  lastDiscoveryAt: string | null;
  blockedSources: { source: string; reason: string }[];
  queue: number;
  openQuestions: number;
  llm: string | null;
  appliedToday: number;
}
