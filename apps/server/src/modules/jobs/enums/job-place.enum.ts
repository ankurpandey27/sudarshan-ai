// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** How a job is worked. */
export enum WorkMode {
  REMOTE = 'remote',
  HYBRID = 'hybrid',
  ONSITE = 'onsite',
}

/** Where a job is, measured from the country in your profile. */
export enum JobRegion {
  /** In your country (remote, hybrid or on-site). */
  HOME = 'home',
  /** In another country, or open to anyone anywhere. */
  ABROAD = 'abroad',
  /** Not said: a bare "Remote", for example. */
  UNKNOWN = 'unknown',
}
