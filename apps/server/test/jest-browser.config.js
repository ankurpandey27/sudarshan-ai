// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

// Browser tests use the system's Chrome/Edge in headless mode.
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '..',
  testMatch: ['<rootDir>/test/**/*.browser-spec.ts'],
  transform: { '^.+\.(t|j)s$': 'ts-jest' },
  testEnvironment: 'node',
  testTimeout: 120000,
};
