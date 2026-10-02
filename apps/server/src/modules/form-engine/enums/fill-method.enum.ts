// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** Ways to operate a field - what a person does with their mouse and keys. */
export enum FillMethod {
  /** Set the value the usual way (Sudarshan's own filler). */
  NATIVE = 'native',
  /** Click into it and type, key by key. */
  KEYS = 'keys',
  /** Click it open and click the option. */
  OPEN_PICK = 'open-pick',
  /** Type to search, then click the matching suggestion. */
  TYPE_PICK = 'type-pick',
  /** Type, then press Enter. */
  TYPE_ENTER = 'type-enter',
  /** Click the choice's own words near the field (custom radios, chips, checkbox lists). */
  LABEL_CLICK = 'label-click',
}
