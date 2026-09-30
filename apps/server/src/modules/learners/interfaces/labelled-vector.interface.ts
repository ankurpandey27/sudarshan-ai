// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** A training example as a meaning-vector with its answer ("phone", "forward"...). */
export interface LabelledVector {
  text: string;
  label: string;
  vector: Float32Array;
  /** How many times it was seen: repeated examples count more. */
  weight: number;
}

/** A vote of the nearest examples. */
export interface KnnVote {
  label: string;
  /** 0-1: the share of the neighbours' weighted vote for it. */
  agreement: number;
  /** Similarity of the closest neighbour with that label. */
  similarity: number;
  /** The closest example, to explain the choice. */
  nearest: string;
}
