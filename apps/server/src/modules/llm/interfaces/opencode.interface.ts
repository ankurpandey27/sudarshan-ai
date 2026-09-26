export type OpencodeProtocol = 'chat' | 'messages' | 'responses' | 'gemini';

export interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}
