// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useEffect, useState } from 'react';

type Detector = { detect(text: string): Promise<{ detectedLanguage: string; confidence: number }[]> };
type Translator = { translate(text: string): Promise<string> };
type AiGlobals = {
  LanguageDetector?: { create(): Promise<Detector> };
  Translator?: {
    availability(o: { sourceLanguage: string; targetLanguage: string }): Promise<string>;
    create(o: { sourceLanguage: string; targetLanguage: string }): Promise<Translator>;
  };
};

let detector: Promise<Detector | null> | null = null;
const translators = new Map<string, Promise<Translator | null>>();
const done = new Map<string, Promise<string | null>>();

/**
 * The browser's own translator (Chrome and Edge, on this computer, nothing sent anywhere): used when
 * Sudarshan has no English for a question yet - no AI model set, or it is still being translated.
 */
function browserEnglish(text: string): Promise<string | null> {
  const cached = done.get(text);
  if (cached) return cached;
  const aiGlobals = globalThis as unknown as AiGlobals;
  const job = (async () => {
    if (!aiGlobals.LanguageDetector || !aiGlobals.Translator) return null;
    try {
      detector ??= aiGlobals.LanguageDetector.create().catch(() => null);
      const detect = await detector;
      const [top] = (await detect?.detect(text)) ?? [];
      if (!top || top.detectedLanguage === 'en' || top.detectedLanguage === 'und' || top.confidence < 0.4) return null;
      const lang = top.detectedLanguage;
      if (!translators.has(lang)) {
        translators.set(
          lang,
          aiGlobals.Translator.availability({ sourceLanguage: lang, targetLanguage: 'en' })
            .then((a) => (a === 'unavailable' ? null : aiGlobals.Translator!.create({ sourceLanguage: lang, targetLanguage: 'en' })))
            .catch(() => null),
        );
      }
      const translator = await translators.get(lang);
      return translator ? await translator.translate(text) : null;
    } catch {
      return null;
    }
  })();
  done.set(text, job);
  return job;
}

/** English for a question: Sudarshan's (from your AI model) when it has one, else the browser's own translation. */
export function useEnglish(text: string, known: string | null | undefined, foreign: boolean | undefined): string | null {
  const [fromBrowser, setFromBrowser] = useState<string | null>(null);
  useEffect(() => {
    if (known || !foreign || !text) return;
    let live = true;
    void browserEnglish(text).then((en) => live && setFromBrowser(en));
    return () => {
      live = false;
    };
  }, [text, known, foreign]);
  const en = known || fromBrowser;
  return en && en.trim().toLowerCase() !== text.trim().toLowerCase() ? en : null;
}
