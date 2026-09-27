// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

/** The domain itself or a real subdomain of it: "in.indeed.com" is Indeed, "evilindeed.com" is not. */
export const isHostOf = (host: string, domain: string): boolean => host === domain || host.endsWith(`.${domain}`);
