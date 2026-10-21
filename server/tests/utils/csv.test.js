import { describe, expect, it } from 'vitest';
import { csvCell, csvFilename, csvLine } from '../../src/utils/csv.js';

describe('csvCell', () => {
  it('writes plain text, numbers, booleans and dates as they are', () => {
    expect(csvCell('Claw Hammer')).toBe('Claw Hammer');
    expect(csvCell(12.5)).toBe('12.5');
    expect(csvCell(0)).toBe('0');
    expect(csvCell(true)).toBe('true');
    expect(csvCell(new Date('2026-10-14T20:30:00Z'))).toBe('2026-10-14T20:30:00.000Z');
  });

  it('leaves missing values empty', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell('')).toBe('');
  });

  it.each(['=SUM(A1)', '+1+1', '-2+3', '@SUM(A1)', '\t=1', '\r=1'])(
    'escapes the formula start of %j with an apostrophe',
    (text) => {
      expect(csvCell(text).replace(/^"|"$/g, '')).toMatch(/^'/);
    },
  );

  it('keeps negative numbers as numbers, not text', () => {
    expect(csvCell(-5)).toBe('-5');
    expect(csvCell('-5')).toBe("'-5");
  });

  it('only checks the first character', () => {
    expect(csvCell('a=b')).toBe('a=b');
    expect(csvCell('Cable - 2m')).toBe('Cable - 2m');
  });

  it('quotes commas, quotes and line breaks and doubles inner quotes', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('one\ntwo')).toBe('"one\ntwo"');
  });

  it('escapes and quotes together', () => {
    expect(csvCell('=HYPERLINK("x","y")')).toBe('"\'=HYPERLINK(""x"",""y"")"');
  });

  it('keeps Persian text unchanged', () => {
    expect(csvCell('چکش')).toBe('چکش');
  });
});

describe('csvLine', () => {
  it('joins cells with commas and ends with CRLF', () => {
    expect(csvLine(['a', 1, null, '=1'])).toBe("a,1,,'=1\r\n");
  });
});

describe('csvFilename', () => {
  it('names the file after the day in UTC', () => {
    expect(csvFilename('movements', new Date('2026-10-21T23:59:00Z'))).toBe(
      'movements-2026-10-21.csv',
    );
  });
});
