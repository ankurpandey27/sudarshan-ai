import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type {
  AgentStatus,
  Answer,
  BrowserStatus,
  Job,
  Insight,
  JobStats,
  LlmPreset,
  LlmUsage,
  Paginated,
  PendingQuestion,
  ProfileState,
  Settings,
} from './types';

export const useSettings = () => useQuery({ queryKey: ['settings'], queryFn: () => api.get<Settings>('/settings') });
export const useProfile = () => useQuery({ queryKey: ['profile'], queryFn: () => api.get<ProfileState>('/profile') });
export const useAgent = () =>
  useQuery({ queryKey: ['agent'], queryFn: () => api.get<AgentStatus>('/agent/status'), refetchInterval: 5000 });
export const useStats = () => useQuery({ queryKey: ['stats'], queryFn: () => api.get<JobStats>('/jobs/stats') });
export const useBrowser = () =>
  useQuery({ queryKey: ['browser'], queryFn: () => api.get<BrowserStatus>('/browser/status'), refetchInterval: 8000 });
export const useQuestions = () => useQuery({ queryKey: ['questions'], queryFn: () => api.get<PendingQuestion[]>('/questions') });
export const useAnswers = (search: string) =>
  useQuery({ queryKey: ['answers', search], queryFn: () => api.get<Answer[]>(`/answers${search ? `?search=${encodeURIComponent(search)}` : ''}`) });
export const usePresets = () =>
  useQuery({ queryKey: ['presets'], queryFn: () => api.get<LlmPreset[]>('/llm/providers'), staleTime: Infinity });
export const useUsage = () => useQuery({ queryKey: ['usage'], queryFn: () => api.get<LlmUsage>('/llm/usage'), refetchInterval: 30000 });

export const useJobs = (params: { status?: string; source?: string; search?: string; sort?: string; page?: number; limit?: number }) => {
  const qs = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  );
  return useQuery({
    queryKey: ['jobs', params],
    queryFn: () => api.get<Paginated<Job>>(`/jobs?${qs}`),
    placeholderData: (prev) => prev,
  });
};

export const useInsights = () =>
  useQuery({ queryKey: ['insights'], queryFn: () => api.get<Insight[]>('/agent/insights'), refetchInterval: 10000 });
