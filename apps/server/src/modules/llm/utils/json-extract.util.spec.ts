import { extractJson } from './json-extract.util';

describe('extractJson', () => {
  it('reads JSON wrapped in prose, fences and reasoning traces', () => {
    expect(extractJson('<think>maybe {"x":1}</think>Sure! ```json\n{"a":{"b":"}"}}\n``` done')).toEqual({ a: { b: '}' } });
    expect(extractJson('Here: [1,2,3] ok')).toEqual([1, 2, 3]);
  });

  it('throws on replies without JSON', () => {
    expect(() => extractJson('I cannot help with that')).toThrow('No JSON');
  });
});
