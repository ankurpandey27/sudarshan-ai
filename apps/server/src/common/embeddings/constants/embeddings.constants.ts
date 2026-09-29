// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/**
 * The meaning model: small (about 120 MB, compressed), 50+ languages, built to tell whether two
 * sentences say the same thing. Chosen by measurement on real saved answers (2026-09-30): it ranked
 * similar questions better than multilingual-e5-small once guardrails applied.
 */
export const EMBEDDING_MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
export const EMBEDDING_DTYPE = 'q8';
/** The model file itself; its presence means the model is downloaded. Keep in sync with scripts/fetch-model.mjs. */
export const EMBEDDING_MODEL_FILE = 'onnx/model_quantized.onnx';
export const EMBEDDING_DIMS = 384;
/** Texts embedded per call - keeps memory flat on small machines. */
export const EMBEDDING_BATCH = 32;
/** Giving up on loading (a first download on a slow line can take a while). */
export const EMBEDDING_LOAD_TIMEOUT_MS = 10 * 60_000;
