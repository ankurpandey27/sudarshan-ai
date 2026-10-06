// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

// Theme: the same choice as the app.
document.getElementById('theme').addEventListener('click', function () {
  var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('jaa-theme', next); } catch (e) {}
});

// Contents on small screens.
var toc = document.getElementById('toc');
document.getElementById('menu').addEventListener('click', function () { toc.classList.toggle('open'); });
toc.addEventListener('click', function (e) { if (e.target.closest('a')) toc.classList.remove('open'); });

// Click a screenshot to see it full size.
var zoom = document.getElementById('zoom');
document.querySelectorAll('figure img').forEach(function (img) {
  img.loading = 'lazy';
  img.addEventListener('click', function () {
    zoom.querySelector('img').src = img.src;
    zoom.querySelector('img').alt = img.alt;
    var cap = img.parentElement.querySelector('figcaption');
    zoom.querySelector('p').textContent = cap ? cap.textContent : img.alt;
    zoom.showModal();
  });
});
zoom.addEventListener('click', function () { zoom.close(); });

// Highlight the section being read.
var links = Array.prototype.slice.call(document.querySelectorAll('.toc a.item'));
var byId = {};
links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
var seen = new IntersectionObserver(function (entries) {
  entries.forEach(function (e) {
    if (!e.isIntersecting) return;
    links.forEach(function (a) { a.classList.remove('active'); });
    var a = byId[e.target.id];
    if (a) { a.classList.add('active'); a.scrollIntoView({ block: 'nearest' }); }
  });
}, { rootMargin: '-15% 0px -75% 0px' });
document.querySelectorAll('section.doc').forEach(function (s) { seen.observe(s); });
