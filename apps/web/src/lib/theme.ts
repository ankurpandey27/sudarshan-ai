// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

function initial(): Theme {
  try {
    const saved = localStorage.getItem('jaa-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Storage blocked: follow the OS.
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(initial);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('jaa-theme', theme);
    } catch {
    }
  }, [theme]);
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))];
}
