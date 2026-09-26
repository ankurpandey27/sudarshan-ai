import { isReachable, proximity, resolveCities } from './geo.util';

describe('geo.util', () => {
  it('resolves bare cities, aliases and multi-city lists', () => {
    expect(resolveCities('Bengaluru').map((c) => c.name)).toEqual(['bengaluru']);
    expect(resolveCities('Bangalore Urban, Karnataka').map((c) => c.name)).toEqual(['bengaluru']);
    expect(resolveCities('Hyderabad, Pune').map((c) => c.name)).toEqual(['hyderabad', 'pune']);
    expect(resolveCities('Gurgaon (Hybrid)').map((c) => c.name)).toEqual(['gurugram']);
  });

  it('country-level profile accepts every city in that country', () => {
    expect(proximity('India', 'Bengaluru').relation).toBe('same');
    expect(isReachable('India', 'Hyderabad, Pune')).toBe(true);
    expect(isReachable('India', 'Singapore')).toBe(false);
  });

  it('city profile: same city / nearby (<=150km) / far, and the 1000km spec rule', () => {
    expect(proximity('Bangalore', 'Bengaluru, Karnataka, India').relation).toBe('same');
    expect(proximity('Delhi', 'Noida').relation).toBe('same'); // one metro (~20km)
    expect(proximity('Mumbai', 'Pune').relation).toBe('nearby'); // ~120km
    expect(proximity('Bangalore', 'Chennai').relation).toBe('far');
    expect(isReachable('Bangalore', 'Chennai')).toBe(true); // ~290km
    expect(isReachable('Bangalore', 'Delhi')).toBe(false); // ~1740km
  });

  it('best of several job cities counts', () => {
    expect(proximity('Pune', 'Hyderabad, Pune').relation).toBe('same');
  });

  it('unknown places never block', () => {
    expect(proximity('India', 'Somewhere Unlisted').relation).toBe('unknown');
    expect(isReachable('India', 'Somewhere Unlisted')).toBe(true);
    expect(isReachable('', 'Delhi')).toBe(true);
  });
});
