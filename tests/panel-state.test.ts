import { describe, expect, it } from 'vitest';
import { SourceError, type SourceErrorCode } from '@/audio/sources/errors';
import type { SourceKind } from '@/audio/sources/types';
import {
  copyFor,
  INITIAL_STATE,
  nextState,
  rendersCanvas,
  type PanelState,
} from '@/entrypoints/sidepanel/state';

const playing: PanelState = { view: 'playing', kind: 'tab', silent: false };
const err = (code: SourceErrorCode, kind: SourceKind) => new SourceError(code, kind);

describe('nextState', () => {
  it('starts on the picker with no notice', () => {
    expect(INITIAL_STATE).toEqual({ view: 'picker' });
  });

  it('select → loading → playing', () => {
    const loading = nextState(INITIAL_STATE, { type: 'select', kind: 'mic' });
    expect(loading).toEqual({ view: 'loading', kind: 'mic' });
    expect(nextState(loading, { type: 'started' })).toEqual({
      view: 'playing',
      kind: 'mic',
      silent: false,
    });
  });

  it('select from an error or while playing starts over', () => {
    const error: PanelState = { view: 'error', error: err('mic-failed', 'mic') };
    expect(nextState(error, { type: 'select', kind: 'file' }).view).toBe('loading');
    expect(nextState(playing, { type: 'select', kind: 'file' }).view).toBe('loading');
  });

  it.each([
    ['unavailable', 'tab', "Tab audio isn't available yet."],
    ['file-undecodable', 'file', "Couldn't decode that file."],
  ] as const)('%s failure returns to the picker with a notice', (code, kind, notice) => {
    const loading: PanelState = { view: 'loading', kind };
    expect(nextState(loading, { type: 'failed', error: err(code, kind) })).toEqual({
      view: 'picker',
      notice,
    });
  });

  it.each([
    ['tab-capture-failed', 'tab'],
    ['mic-denied', 'mic'],
    ['mic-failed', 'mic'],
  ] as const)('%s failure shows the error view', (code, kind) => {
    const error = err(code, kind);
    const next = nextState({ view: 'loading', kind }, { type: 'failed', error });
    expect(next).toEqual({ view: 'error', error });
  });

  it('captured tab closing returns to the picker', () => {
    expect(nextState(playing, { type: 'ended', error: err('tab-ended', 'tab') })).toEqual({
      view: 'picker',
      notice: 'The captured tab was closed.',
    });
  });

  it('a source ending cleanly returns to the picker without a notice', () => {
    expect(nextState(playing, { type: 'ended' })).toEqual({ view: 'picker' });
  });

  it('ignores stale events that do not apply to the current view', () => {
    const picker: PanelState = { view: 'picker', notice: 'kept' };
    expect(nextState(picker, { type: 'started' })).toBe(picker);
    expect(nextState(picker, { type: 'ended' })).toBe(picker);
    expect(nextState(picker, { type: 'failed', error: err('mic-failed', 'mic') })).toBe(picker);
    expect(nextState(picker, { type: 'silence' })).toBe(picker);
    expect(nextState(picker, { type: 'dismiss' })).toBe(picker);
  });

  it('silence and sound toggle the banner, returning the same object when unchanged', () => {
    const silent = nextState(playing, { type: 'silence' });
    expect(silent).toEqual({ ...playing, silent: true });
    expect(nextState(silent, { type: 'silence' })).toBe(silent);
    expect(nextState(silent, { type: 'sound' })).toEqual(playing);
    expect(nextState(playing, { type: 'sound' })).toBe(playing);
  });

  it('dismiss leaves the error view for a clean picker', () => {
    const error: PanelState = { view: 'error', error: err('mic-denied', 'mic') };
    expect(nextState(error, { type: 'dismiss' })).toEqual({ view: 'picker' });
  });
});

describe('rendersCanvas', () => {
  it('is true only while playing with sound', () => {
    expect(rendersCanvas(playing)).toBe(true);
    expect(rendersCanvas({ ...playing, silent: true })).toBe(false);
    expect(rendersCanvas(INITIAL_STATE)).toBe(false);
    expect(rendersCanvas({ view: 'loading', kind: 'tab' })).toBe(false);
    expect(rendersCanvas({ view: 'error', error: err('mic-failed', 'mic') })).toBe(false);
  });
});

describe('copyFor', () => {
  it('never shows the raw error message', () => {
    const codes: [SourceErrorCode, SourceKind][] = [
      ['unavailable', 'tab'],
      ['tab-capture-failed', 'tab'],
      ['tab-ended', 'tab'],
      ['mic-denied', 'mic'],
      ['mic-failed', 'mic'],
      ['file-undecodable', 'file'],
    ];
    for (const [code, kind] of codes) {
      const error = new SourceError(code, kind, { message: 'RAW-INTERNAL-DETAIL' });
      const { title, body } = copyFor(error);
      expect(title).not.toContain('RAW-INTERNAL-DETAIL');
      expect(body).not.toContain('RAW-INTERNAL-DETAIL');
      expect(title).not.toMatch(/TODO|LOS-/);
    }
  });

  it('routes recovery actions per the LOS-19 spec', () => {
    expect(copyFor(err('mic-denied', 'mic')).action).toBe('open-mic-settings');
    expect(copyFor(err('mic-failed', 'mic')).action).toBe('retry');
    // Tab capture can only be re-requested from the toolbar icon (LOS-17).
    expect(copyFor(err('tab-capture-failed', 'tab')).action).toBe('retry-via-icon');
  });
});
