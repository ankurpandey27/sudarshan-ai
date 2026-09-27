// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { createServer, IncomingMessage, Server, ServerResponse } from 'node:http';
import { AddressInfo } from 'node:net';
import { LlmProviderKind } from '../enums/llm-provider-kind.enum';
import { AnthropicTransport } from './anthropic.transport';
import { OpencodeTransport } from './opencode.transport';
import { OpenAiCompatibleTransport } from './openai-compatible.transport';

type Body = Record<string, unknown>;
type Handler = (body: Body, path: string) => { status: number; json: unknown };

const openAiError = (message: string, param: string | null = null) => ({
  status: 400,
  json: { error: { message, type: 'invalid_request_error', param, code: 'unsupported_value' } },
});
const chatOk = (content = '{"ok":true}', finish = 'stop') => ({
  status: 200,
  json: { choices: [{ message: { content }, finish_reason: finish }], usage: { prompt_tokens: 3, completion_tokens: 2 } },
});

/** A fake provider: records every request body and answers with `handler`. */
async function fakeProvider(handler: Handler): Promise<{ url: string; requests: Body[]; close: () => Promise<void> }> {
  const requests: Body[] = [];
  const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const body = raw ? (JSON.parse(raw) as Body) : {};
      requests.push(body);
      const { status, json } = handler(body, req.url ?? '');
      res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(json));
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}`, requests, close: () => new Promise((r) => server.close(() => r())) };
}

const req = { prompt: 'Say ok as JSON', maxTokens: 100, json: true };

describe('LLM transports adapt to what each model accepts', () => {
  it('OpenAI model that only allows the default temperature (gpt-6-astra)', async () => {
    const p = await fakeProvider((b) =>
      'temperature' in b
        ? openAiError("Unsupported value: 'temperature' does not support 0 with this model. Only the default (1) value is supported.", 'temperature')
        : chatOk(),
    );
    const t = new OpenAiCompatibleTransport(LlmProviderKind.OPENAI, 'gpt-6-astra', `${p.url}/v1`, 'sk-test', false);
    expect((await t.complete(req)).text).toBe('{"ok":true}');
    expect(p.requests).toHaveLength(2);
    // Remembered: the next call succeeds first time, without temperature and with room to reason.
    await t.complete(req);
    expect(p.requests).toHaveLength(3);
    expect(p.requests[2]).not.toHaveProperty('temperature');
    expect(p.requests[2].max_completion_tokens).toBeGreaterThan(req.maxTokens);
    await p.close();
  });

  it('server that wants max_completion_tokens instead of max_tokens', async () => {
    const p = await fakeProvider((b) =>
      'max_tokens' in b
        ? openAiError("Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead.", 'max_tokens')
        : chatOk(),
    );
    const t = new OpenAiCompatibleTransport(LlmProviderKind.OPENROUTER, 'some/new-model', p.url, 'k', false);
    await t.complete(req);
    expect(p.requests[1]).toHaveProperty('max_completion_tokens', 100);
    await p.close();
  });

  it('local server without JSON mode', async () => {
    const p = await fakeProvider((b) => ('response_format' in b ? { status: 400, json: { error: 'response_format json_object is not supported' } } : chatOk()));
    const t = new OpenAiCompatibleTransport(LlmProviderKind.OLLAMA, 'qwen2.5:7b', p.url, '', true);
    await t.complete(req);
    await t.complete(req);
    expect(p.requests.map((r) => 'response_format' in r)).toEqual([true, false, false]);
    await p.close();
  });

  it('model that rejects every optional parameter still answers', async () => {
    const p = await fakeProvider((b) => {
      for (const k of ['temperature', 'reasoning_effort', 'response_format']) {
        if (k in b) return openAiError(`Unsupported parameter: '${k}' is not supported with this model.`, k);
      }
      return chatOk();
    });
    const t = new OpenAiCompatibleTransport(LlmProviderKind.OPENAI, 'future-model', p.url, 'k', false);
    expect((await t.complete(req)).text).toBe('{"ok":true}');
    expect(p.requests.at(-1)).toEqual({ model: 'future-model', messages: expect.any(Array), max_completion_tokens: expect.any(Number) });
    await p.close();
  });

  it('reasoning model that used its whole budget thinking gets one retry with more room', async () => {
    let calls = 0;
    const p = await fakeProvider(() => (++calls === 1 ? chatOk('', 'length') : chatOk()));
    const t = new OpenAiCompatibleTransport(LlmProviderKind.OPENAI, 'o4-mini', p.url, 'k', false);
    expect((await t.complete(req)).text).toBe('{"ok":true}');
    expect(Number(p.requests[1].max_completion_tokens)).toBeGreaterThan(Number(p.requests[0].max_completion_tokens));
    await p.close();
  });

  it('a real error (not a parameter problem) is raised after a single request', async () => {
    const p = await fakeProvider(() => ({ status: 400, json: { error: { message: 'The model `nope` does not exist', param: 'model' } } }));
    const t = new OpenAiCompatibleTransport(LlmProviderKind.OPENAI, 'nope', p.url, 'k', false);
    await expect(t.complete(req)).rejects.toThrow();
    expect(p.requests).toHaveLength(1);
    await p.close();
  });

  it('Claude model that does not accept effort', async () => {
    const p = await fakeProvider((b) =>
      b.output_config
        ? { status: 400, json: { type: 'error', error: { type: 'invalid_request_error', message: 'output_config.effort: Extra inputs are not permitted' } } }
        : {
            status: 200,
            json: {
              id: 'msg_1',
              type: 'message',
              role: 'assistant',
              model: 'claude-new',
              content: [{ type: 'text', text: 'ok' }],
              stop_reason: 'end_turn',
              usage: { input_tokens: 3, output_tokens: 1 },
            },
          },
    );
    const t = new AnthropicTransport('claude-new', 'sk-ant-test', p.url);
    expect((await t.complete(req)).text).toBe('ok');
    await t.complete(req);
    expect(p.requests.map((r) => 'output_config' in r)).toEqual([true, false, false]);
    await p.close();
  });

  it('OpenCode Zen model that only allows the default temperature', async () => {
    const p = await fakeProvider((b) =>
      'temperature' in b ? openAiError("Unsupported value: 'temperature' does not support 0 with this model.", 'temperature') : chatOk(),
    );
    const t = new OpencodeTransport('kimi-k3', p.url, 'k');
    expect((await t.complete(req)).text).toBe('{"ok":true}');
    expect(p.requests.every((r) => r.model === 'kimi-k3')).toBe(true);
    expect(p.requests.at(-1)).not.toHaveProperty('temperature');
    await p.close();
  });
});
