import { describe, expect, it } from 'vitest';
import { SourceError, toSourceError } from '@/audio/sources/errors';

describe('toSourceError', () => {
  it('passes a SourceError through untouched', () => {
    const original = new SourceError('tab-ended', 'tab');
    expect(toSourceError(original, 'mic')).toBe(original);
  });

  it('maps TODO stubs to unavailable, keeping the original as cause', () => {
    const stub = new Error('TODO LOS-10: createTabSource (blocked by spike LOS-17)');
    const error = toSourceError(stub, 'tab');
    expect(error.code).toBe('unavailable');
    expect(error.kind).toBe('tab');
    expect(error.cause).toBe(stub);
  });

  it('maps a denied mic prompt to mic-denied', () => {
    const denied = new DOMException('Permission denied', 'NotAllowedError');
    expect(toSourceError(denied, 'mic').code).toBe('mic-denied');
  });

  it('maps a decode failure to file-undecodable', () => {
    const bad = new DOMException('Unable to decode audio data', 'EncodingError');
    expect(toSourceError(bad, 'file').code).toBe('file-undecodable');
  });

  it.each([
    ['tab', 'tab-capture-failed'],
    ['mic', 'mic-failed'],
    ['file', 'file-undecodable'],
  ] as const)('falls back per kind: %s → %s', (kind, code) => {
    expect(toSourceError(new Error('boom'), kind).code).toBe(code);
    expect(toSourceError('not even an Error', kind).code).toBe(code);
  });

  it('does not treat NotAllowedError on a tab as a mic denial', () => {
    const denied = new DOMException('nope', 'NotAllowedError');
    expect(toSourceError(denied, 'tab').code).toBe('tab-capture-failed');
  });
});
