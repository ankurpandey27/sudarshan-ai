// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

// Downloads the answer-matching model into ./models once, so Sudarshan is ready on the first start.
// Runs after `npm install` and from `npm start`; never fails either - without the model, Sudarshan
// works as before. Skip it with SUDARSHAN_SKIP_MODEL=1.
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

// Keep in sync with apps/server/src/common/embeddings/constants/embeddings.constants.ts (a test checks it).
export const MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
export const MODEL_FILE = 'onnx/model_quantized.onnx';

const root = join(import.meta.dirname, '..');
export const modelsDir = process.env.SUDARSHAN_MODELS_DIR || join(root, 'models');

/** The model is already in the models folder. */
export const haveModel = () => existsSync(join(modelsDir, MODEL, MODEL_FILE));

/** Downloads the model if it is missing; resolves to true when it is there, false otherwise - never throws. */
export async function fetchModel({ quiet = false } = {}) {
  if (haveModel()) return true;
  if (process.env.SUDARSHAN_SKIP_MODEL === '1') return false;
  const say = (m) => !quiet && console.log(m);
  try {
    // The library comes with the server's dependencies; before `npm install` there is nothing to do.
    const require = createRequire(join(root, 'apps', 'server', 'package.json'));
    const { pipeline, env } = require('@huggingface/transformers');
    env.cacheDir = modelsDir;
    env.localModelPath = modelsDir;
    say(`  Downloading the answer-matching model (about 130 MB, once) into ${modelsDir}`);
    const embed = await pipeline('feature-extraction', MODEL, { dtype: 'q8' });
    // One real use, so a broken download is caught now rather than while applying.
    await embed(['ready?'], { pooling: 'mean', normalize: true });
    say('  Answer-matching model ready');
    return haveModel();
  } catch (err) {
    say(`  Could not get the answer-matching model now (${err.message.split('\n')[0]}) - Sudarshan works without it and tries again on the next start.`);
    return false;
  }
}

// Run directly (npm postinstall, `npm run model`): fetch, and always exit 0.
if (process.argv[1] && import.meta.filename === process.argv[1]) {
  await fetchModel();
  process.exit(0);
}
