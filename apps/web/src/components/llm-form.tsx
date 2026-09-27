// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CircleAlert, Cpu, ExternalLink, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/format';
import { usePresets, useSettings } from '../lib/queries';
import type { LlmProviderKind, Settings } from '../lib/types';
import { Button, Field, Input } from './ui';
import { useToast } from './toast';

interface TestResult {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

export function LlmForm({ slot = 'llm', onSaved }: { slot?: 'llm' | 'fallbackLlm'; onSaved?: () => void }) {
  const { data: presets = [] } = usePresets();
  const { data: settings } = useSettings();
  const saved = settings?.[slot];
  const qc = useQueryClient();
  const toast = useToast();

  const [provider, setProvider] = useState<LlmProviderKind>('none');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [test, setTest] = useState<TestResult | null>(null);

  useEffect(() => {
    if (!saved) return;
    setProvider(saved.provider);
    setModel(saved.model);
    setBaseUrl(saved.baseUrl);
  }, [saved]);

  const preset = presets.find((p) => p.kind === provider);
  const probe = () => ({ slot, provider, model, baseUrl, ...(apiKey ? { apiKey } : {}) });

  const listModels = useMutation({
    mutationFn: () => api.post<{ models: string[]; error?: string }>('/llm/models', probe()),
    onSuccess: (r) => {
      setModels(r.models);
      if (r.error) toast('error', r.error);
      else if (!r.models.length) toast('error', 'The provider returned no models');
    },
  });
  const runTest = useMutation({
    mutationFn: () => api.post<TestResult>('/llm/test', probe()),
    onSuccess: setTest,
    onError: (e: Error) => setTest({ ok: false, latencyMs: 0, error: e.message }),
  });
  const save = useMutation({
    mutationFn: () => api.patch<Settings>('/settings', { [slot]: { provider, model, baseUrl, ...(apiKey ? { apiKey } : {}) } }),
    onSuccess: (s) => {
      qc.setQueryData(['settings'], s);
      setApiKey('');
      toast('ok', 'AI model saved');
      onSaved?.();
    },
    onError: (e: Error) => toast('error', e.message),
  });

  const choose = (kind: LlmProviderKind) => {
    setProvider(kind);
    const p = presets.find((x) => x.kind === kind);
    setModel(kind === saved?.provider ? saved.model : (p?.suggestedModels[0] ?? ''));
    setBaseUrl(kind === saved?.provider ? saved.baseUrl : '');
    setApiKey('');
    setModels([]);
    setTest(null);
  };

  const keyReady = !preset?.needsKey || apiKey || (saved?.provider === provider && saved.hasApiKey);
  const suggestions = [...new Set([...(preset?.suggestedModels ?? []), ...models])];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {presets.map((p) => (
          <button
            key={p.kind}
            type="button"
            onClick={() => choose(p.kind)}
            className={cn(
              'rounded-lg border px-3 py-2.5 text-left transition-colors',
              provider === p.kind ? 'border-accent bg-accent-soft/60' : 'border-line bg-surface hover:border-line-strong',
            )}
          >
            <span className="flex items-center gap-1.5 text-[13.5px] font-semibold">
              {p.local && <Cpu className="size-3.5 text-good" />}
              {p.label}
            </span>
            <span className="mt-0.5 block text-[12px] text-ink-3">{p.local ? 'Free, private, on your PC' : p.note ?? 'Your API key'}</span>
          </button>
        ))}
      </div>

      {preset && (
        <div className="grid gap-3 sm:grid-cols-2">
          {preset.needsKey && (
            <Field
              label="API key"
              hint={
                <>
                  {saved?.provider === provider && saved.hasApiKey ? `Saved (${saved.apiKeyHint}). Leave blank to keep it. ` : 'Stored encrypted on this computer only. '}
                  {preset.keyUrl && (
                    <a className="inline-flex items-center gap-0.5 text-info underline-offset-2 hover:underline" href={preset.keyUrl} target="_blank" rel="noreferrer">
                      Get a key <ExternalLink className="size-3" />
                    </a>
                  )}
                </>
              }
            >
              <Input type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Paste your key" />
            </Field>
          )}
          <Field label="Model" hint={preset.note && preset.local ? preset.note : undefined}>
            <div className="flex gap-2">
              <Input list={`models-${slot}`} value={model} onChange={(e) => setModel(e.target.value)} placeholder="Model id" />
              <datalist id={`models-${slot}`}>
                {suggestions.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
              <Button type="button" variant="secondary" title="Load the provider's model list" onClick={() => listModels.mutate()} loading={listModels.isPending} disabled={!keyReady}>
                {!listModels.isPending && <RefreshCw className="size-3.5" />}
              </Button>
            </div>
          </Field>
          {(provider === 'custom' || preset.local || provider === 'opencode') && (
            <Field label="Server URL" hint={`Default: ${preset.baseUrl || 'required'}`} className="sm:col-span-2">
              <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={preset.baseUrl || 'https://your-server/v1'} />
            </Field>
          )}
        </div>
      )}

      {test && (
        <div className={cn('flex items-start gap-2 rounded-lg px-3 py-2 text-[13px]', test.ok ? 'bg-good-soft text-good' : 'bg-bad-soft text-bad')}>
          {test.ok ? <CheckCircle2 className="mt-0.5 size-4" /> : <CircleAlert className="mt-0.5 size-4" />}
          <span>{test.ok ? `Working - replied in ${(test.latencyMs / 1000).toFixed(1)}s` : test.error}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => runTest.mutate()} loading={runTest.isPending} disabled={!preset || !model || !keyReady}>
          Test connection
        </Button>
        <Button type="button" variant="primary" onClick={() => save.mutate()} loading={save.isPending} disabled={!preset || !model || !keyReady}>
          Save model
        </Button>
      </div>
    </div>
  );
}
