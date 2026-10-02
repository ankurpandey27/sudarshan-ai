// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** Sequences that could close or fake the data fence. */
export const UNTRUSTED_FENCE = /<<<|>>>/g;

/** Wording aimed at AI tools rather than people - a job post or page trying to steer the agent reading it. */
export const ADDRESSES_AI =
  /ignore (all |any |the )?(previous|prior|above|earlier|preceding) (instructions|prompts?|rules)|disregard (all |any |the )?(previous|prior|above) (instructions|rules)|(if|attention|note to) (you are )?an? (ai|llm|language model|chatbot|automated (tool|agent|system))|as an (ai|llm|language model)|(ai|llm) (agents?|assistants?|tools?|models?|screeners?)[,:]? (must|should|please|always)|system prompt|you are now|new instructions|(rate|score|rank) this (job|role|position|candidate|application) (as )?(\d|high|top|excellent|perfect)/i;
