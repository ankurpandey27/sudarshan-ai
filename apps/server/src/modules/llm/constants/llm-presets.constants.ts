import { LlmProviderKind } from '../enums/llm-provider-kind.enum';
import { LlmProviderPreset } from '../interfaces/llm-provider-preset.interface';

// Suggested models only; the UI can load each provider's live list.
export const LLM_PRESETS: LlmProviderPreset[] = [
  {
    kind: LlmProviderKind.ANTHROPIC,
    label: 'Anthropic Claude',
    baseUrl: 'https://api.anthropic.com',
    needsKey: true,
    local: false,
    keyUrl: 'https://console.anthropic.com/settings/keys',
    suggestedModels: ['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'],
  },
  {
    kind: LlmProviderKind.OPENAI,
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    needsKey: true,
    local: false,
    keyUrl: 'https://platform.openai.com/api-keys',
    suggestedModels: ['gpt-5-mini', 'gpt-5', 'gpt-4.1-mini'],
  },
  {
    kind: LlmProviderKind.GEMINI,
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    needsKey: true,
    local: false,
    keyUrl: 'https://aistudio.google.com/apikey',
    suggestedModels: ['gemini-2.5-flash', 'gemini-2.5-pro'],
    note: 'Has a free tier - a good zero-cost start.',
  },
  {
    kind: LlmProviderKind.GROQ,
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    needsKey: true,
    local: false,
    keyUrl: 'https://console.groq.com/keys',
    suggestedModels: ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b'],
    note: 'Very fast, free tier available.',
  },
  {
    kind: LlmProviderKind.OPENROUTER,
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    needsKey: true,
    local: false,
    keyUrl: 'https://openrouter.ai/keys',
    suggestedModels: ['anthropic/claude-sonnet-5', 'google/gemini-2.5-flash', 'deepseek/deepseek-chat'],
  },
  {
    kind: LlmProviderKind.OLLAMA,
    label: 'Ollama (local, free)',
    baseUrl: 'http://localhost:11434/v1',
    needsKey: false,
    local: true,
    suggestedModels: ['qwen2.5:7b', 'llama3.1:8b', 'mistral'],
    note: 'Runs on your machine. Install from ollama.com, then run: ollama pull qwen2.5:7b',
  },
  {
    kind: LlmProviderKind.LMSTUDIO,
    label: 'LM Studio (local, free)',
    baseUrl: 'http://localhost:1234/v1',
    needsKey: false,
    local: true,
    suggestedModels: [],
    note: 'Start the local server in LM Studio, then pick the loaded model.',
  },
  {
    kind: LlmProviderKind.OPENCODE,
    label: 'OpenCode Zen',
    baseUrl: 'https://opencode.ai/zen/v1',
    needsKey: true,
    local: false,
    keyUrl: 'https://opencode.ai/zen',
    suggestedModels: [],
  },
  {
    kind: LlmProviderKind.CUSTOM,
    label: 'Custom (OpenAI-compatible)',
    baseUrl: '',
    needsKey: false,
    local: false,
    suggestedModels: [],
    note: 'vLLM, Together, Fireworks, DeepSeek - any /chat/completions endpoint.',
  },
];

export const presetFor = (kind: LlmProviderKind): LlmProviderPreset | undefined =>
  LLM_PRESETS.find((p) => p.kind === kind);
