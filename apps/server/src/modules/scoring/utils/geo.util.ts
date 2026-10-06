// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { Place, Proximity } from '../interfaces/geo.interface';
import { CITIES, COUNTRIES, NEARBY_KM, REACHABLE_KM } from '../constants/geo.constants';

const CITY_INDEX = new Map<string, Place>();
for (const [name, country, lat, lon, aliases] of CITIES) {
  const place = { name, country, lat, lon };
  CITY_INDEX.set(name, place);
  for (const alias of aliases ?? []) CITY_INDEX.set(alias, place);
}

// "Hyderabad, Pune / Remote (Hybrid)" -> candidate place names
function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .split(/[,/|;·•]|\s+-\s+|\band\b/)
    .map((t) => t.replace(/[^a-z\s.-]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

export function resolveCities(text: string): Place[] {
  const found: Place[] = [];
  for (const token of tokens(text)) {
    const hit = CITY_INDEX.get(token) ?? [...CITY_INDEX.entries()].find(([k]) => token.includes(k) && k.length >= 4)?.[1];
    if (hit && !found.includes(hit)) found.push(hit);
  }
  return found;
}

export function resolveCountry(text: string): string | null {
  for (const token of tokens(text)) {
    const country = COUNTRIES[token];
    if (country) return country;
  }
  return resolveCities(text)[0]?.country ?? null;
}

export function distanceKm(a: Place, b: Place): number {
  if (a.lat === undefined || a.lon === undefined || b.lat === undefined || b.lon === undefined) return Infinity;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const haversine = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(haversine));
}

// The closest of several job cities counts. A country-only profile accepts any city in it.
export function proximity(profileLoc: string, jobLoc: string): { relation: Proximity; km: number | null } {
  const jobCities = resolveCities(jobLoc);
  const jobCountry = resolveCountry(jobLoc);
  const profCities = resolveCities(profileLoc);
  const profCountry = resolveCountry(profileLoc);

  if (profCities.length > 0 && jobCities.length > 0) {
    const km = Math.min(...profCities.flatMap((p) => jobCities.map((j) => distanceKm(p, j))));
    return { relation: km <= 25 ? 'same' : km <= NEARBY_KM ? 'nearby' : 'far', km: Math.round(km) };
  }
  if (profCountry && jobCountry) {
    if (profCities.length === 0) return { relation: profCountry === jobCountry ? 'same' : 'far', km: null };
    return { relation: profCountry === jobCountry ? 'nearby' : 'far', km: null };
  }
  return { relation: 'unknown', km: null };
}

// Reachable unless provably over 1000 km away or in another country.
export function isReachable(profileLoc: string, jobLoc: string): boolean {
  const { relation, km } = proximity(profileLoc, jobLoc);
  if (relation !== 'far') return true;
  return km !== null && km <= REACHABLE_KM;
}
