// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

// The same theme as the app (Settings -> moon button), before the page paints.
(function () {
  var t = null;
  try { t = localStorage.getItem('jaa-theme'); } catch (e) {}
  if (!t) t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', t);
})();
