// Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
// SPDX-License-Identifier: MIT

import { csvCell, toCsv } from './csv.util';

describe('csv', () => {
  it('quotes cells with commas, quotes and line breaks', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a, b')).toBe('"a, b"');
    expect(csvCell('say "yes"')).toBe('"say ""yes"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(5)).toBe('5');
  });

  it('never lets a cell run as a formula in Excel, but keeps negative numbers', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+91 98765')).toBe("'+91 98765");
    expect(csvCell('@sum')).toBe("'@sum");
    expect(csvCell('-cmd')).toBe("'-cmd");
    expect(csvCell('-5')).toBe('-5');
  });

  it('writes a header and rows with a byte-order mark for Excel', () => {
    expect(
      toCsv(
        ['Q', 'A'],
        [
          ['Notice period', '30 days'],
          ['हिंदी', 'हाँ'],
        ],
      ),
    ).toBe('\uFEFFQ,A\r\nNotice period,30 days\r\nहिंदी,हाँ\r\n');
  });
});
