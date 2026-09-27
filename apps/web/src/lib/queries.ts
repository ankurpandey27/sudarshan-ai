// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type {
  AgentStatus,
  AnalyticsReport,
  Answer,
  BrowserStatus,
  JobList,
  Insight,
  JobStats,
  LlmPreset,
  LlmUsage,
  PendingQuestion,
  ProfileState,
  Settings,
} from './types';

export const useSettings = () => useQuery({ queryKey: ['settings'], queryFn: () => api.get<Settings>('/settings') });
export const useProfile = () => useQuery({ queryKey: ['profile'], queryFn: () => api.get<ProfileState>('/profile') });
export const useAgent = () =>
  // Every second while jobs are being scored, so the progress bar moves.
  useQuery({ queryKey: ['agent'], queryFn: () => api.get<AgentStatus>('/agent/status'), refetchInterval: (q) => (q.state.data?.scoring ? 1000 : 5000) });
export const useStats = () => useQuery({ queryKey: ['stats'], queryFn: () => api.get<JobStats>('/jobs/stats') });
export const useBrowser = () => useQuery({ queryKey: ['browser'], queryFn: () => api.get<BrowserStatus>('/browser/status'), refetchInterval: 8000 });
export const useQuestions = () => useQuery({ queryKey: ['questions'], queryFn: () => api.get<PendingQuestion[]>('/questions') });
export const useAnswers = (search: string) =>
  useQuery({ queryKey: ['answers', search], queryFn: () => api.get<Answer[]>(`/answers${search ? `?search=${encodeURIComponent(search)}` : ''}`) });
export const usePresets = () => useQuery({ queryKey: ['presets'], queryFn: () => api.get<LlmPreset[]>('/llm/providers'), staleTime: Infinity });
export const useUsage = () => useQuery({ queryKey: ['usage'], queryFn: () => api.get<LlmUsage>('/llm/usage'), refetchInterval: 30000 });

export const useJobs = (params: { status?: string; source?: string; platform?: string; search?: string; sort?: string; page?: number; limit?: number }) => {
  const qs = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  );
  return useQuery({
    queryKey: ['jobs', params],
    queryFn: () => api.get<JobList>(`/jobs?${qs}`),
    placeholderData: (prev) => prev,
  });
};

export const useInsights = () => useQuery({ queryKey: ['insights'], queryFn: () => api.get<Insight[]>('/agent/insights'), refetchInterval: 10000 });

export const useAnalytics = (days: number, platform: string) =>
  useQuery({
    queryKey: ['analytics', days, platform],
    queryFn: () => api.get<AnalyticsReport>(`/analytics?days=${days}${platform ? `&platform=${platform}` : ''}`),
    placeholderData: (prev) => prev,
    refetchInterval: 30000,
  });
