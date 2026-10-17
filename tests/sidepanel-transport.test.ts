import { describe, expect, it } from 'vitest';
import { pickDroppedFile } from '@/entrypoints/sidepanel/drop';
import { formatTime } from '@/entrypoints/sidepanel/transport';

describe('formatTime', () => {
  it('shows minutes and seconds', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(5.9)).toBe('0:05');
    expect(formatTime(65)).toBe('1:05');
  });

  it('adds hours from an hour on', () => {
    expect(formatTime(3605)).toBe('1:00:05');
  });

  it('shows 0:00 for anything invalid', () => {
    expect(formatTime(Number.NaN)).toBe('0:00');
    expect(formatTime(-3)).toBe('0:00');
    expect(formatTime(Number.POSITIVE_INFINITY)).toBe('0:00');
  });
});

describe('pickDroppedFile', () => {
  const file = (name: string, type: string) => ({ name, type }) as File;

  it('prefers the first audio file', () => {
    expect(
      pickDroppedFile([file('notes.txt', 'text/plain'), file('song.mp3', 'audio/mpeg')])?.name,
    ).toBe('song.mp3');
  });

  it('falls back to the first file, so a bad drop gets the decode error', () => {
    expect(pickDroppedFile([file('notes.txt', 'text/plain')])?.name).toBe('notes.txt');
  });

  it('returns nothing for an empty drop', () => {
    expect(pickDroppedFile([])).toBeUndefined();
    expect(pickDroppedFile(undefined)).toBeUndefined();
  });
});
