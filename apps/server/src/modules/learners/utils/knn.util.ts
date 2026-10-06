// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { cosine } from '../../../common/embeddings/utils/vector.util';
import { KnnVote, LabelledVector } from '../interfaces/labelled-vector.interface';

/**
 * What the nearest examples say: their labels weighted by similarity and how often each was seen.
 * Null when nothing is close. `skip` leaves out examples (the one being tested, in a check).
 */
export function knnVote(query: Float32Array, examples: LabelledVector[], k: number, skip?: (e: LabelledVector) => boolean): KnnVote | null {
  const near = examples
    .filter((e) => !skip?.(e))
    .map((e) => ({ e, s: cosine(query, e.vector) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, k);
  if (near.length === 0 || near[0].s <= 0) return null;
  const votes = new Map<string, number>();
  let total = 0;
  for (const { e, s } of near) {
    const weight = Math.max(0, s) * Math.log2(1 + e.weight);
    votes.set(e.label, (votes.get(e.label) ?? 0) + weight);
    total += weight;
  }
  const [label, score] = [...votes].sort((a, b) => b[1] - a[1])[0];
  const best = near.find((n) => n.e.label === label)!;
  return { label, agreement: total ? score / total : 0, similarity: best.s, nearest: best.e.text };
}
