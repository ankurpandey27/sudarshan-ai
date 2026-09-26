// Some models (DeepSeek, Qwen, Kimi) inline <think> blocks that can contain braces.
export const stripReasoning = (reply: string): string =>
  reply.replace(/<think(?:ing)?>[\s\S]*?<\/think(?:ing)?>/gi, '').replace(/^[\s\S]*<\/think(?:ing)?>/i, '');

export function extractJson<T>(raw: string): T {
  const reply = stripReasoning(raw);
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(reply);
  const text = fenced ? fenced[1] : reply;
  const start = text.search(/[[{]/);
  if (start === -1) throw new Error(`No JSON in model reply: ${reply.slice(0, 160)}`);
  const open = text[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) return JSON.parse(text.slice(start, i + 1)) as T;
  }
  throw new Error(`Unterminated JSON in model reply: ${reply.slice(0, 160)}`);
}

// ~4 characters per token, for APIs that omit usage.
export const estimateTokens = (text: string): number => Math.max(1, Math.round(text.length / 4));
