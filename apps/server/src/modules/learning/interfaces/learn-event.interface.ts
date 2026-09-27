// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { FormSnapshot } from '../../form-engine/interfaces/form-field.interface';

/** Sent by the in-page recorder, with the form as it was at that instant. */
export type LearnEvent = { type: 'edit'; snap: FormSnapshot | null } | { type: 'click'; text: string; snap: FormSnapshot | null };
