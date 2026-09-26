// Offline gazetteer: places resolve to coordinates and country; unknown places never block a job.

export interface Place {
  name: string;
  country: string;
  lat?: number;
  lon?: number;
}

export type CityRow = [name: string, country: string, lat: number, lon: number, aliases?: string[]];

export type Proximity = 'same' | 'nearby' | 'far' | 'unknown';
