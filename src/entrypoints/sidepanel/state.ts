import type { SourceError, SourceErrorCode } from '@/audio/sources/errors';
import type { SourceKind } from '@/audio/sources/types';

/**
 * What the side panel is showing. Pure data; views.ts draws it and main.ts
 * feeds it events. Everything except `playing` covers the canvas.
 */
export type PanelState =
  | { readonly view: 'picker'; readonly notice?: string }
  | { readonly view: 'loading'; readonly kind: SourceKind }
  | { readonly view: 'playing'; readonly kind: SourceKind; readonly silent: boolean }
  | { readonly view: 'error'; readonly error: SourceError };

export type PanelEvent =
  | { readonly type: 'select'; readonly kind: SourceKind }
  | { readonly type: 'started' }
  | { readonly type: 'failed'; readonly error: SourceError }
  | { readonly type: 'ended'; readonly error?: SourceError }
  | { readonly type: 'silence' }
  | { readonly type: 'sound' }
  | { readonly type: 'dismiss' };

export const INITIAL_STATE: PanelState = { view: 'picker' };

export function nextState(state: PanelState, event: PanelEvent): PanelState {
  switch (event.type) {
    case 'select':
      return { view: 'loading', kind: event.kind };
    case 'started':
      return state.view === 'loading'
        ? { view: 'playing', kind: state.kind, silent: false }
        : state;
    case 'failed':
      return state.view === 'loading' || state.view === 'playing' ? fromError(event.error) : state;
    case 'ended':
      if (state.view !== 'playing') return state;
      return event.error ? fromError(event.error) : { view: 'picker' };
    case 'silence':
    case 'sound': {
      if (state.view !== 'playing') return state;
      const silent = event.type === 'silence';
      return state.silent === silent ? state : { ...state, silent };
    }
    case 'dismiss':
      return state.view === 'error' ? { view: 'picker' } : state;
  }
}

/** The render loop runs only while the canvas is the thing on screen. */
export function rendersCanvas(state: PanelState): boolean {
  return state.view === 'playing' && !state.silent;
}

/** Recoverable-by-picking-again errors go back to the picker with a one-line notice. */
const PICKER_NOTICE: ReadonlySet<SourceErrorCode> = new Set([
  'unavailable',
  'tab-ended',
  'file-undecodable',
]);

function fromError(error: SourceError): PanelState {
  return PICKER_NOTICE.has(error.code)
    ? { view: 'picker', notice: copyFor(error).title }
    : { view: 'error', error };
}

export type ErrorAction =
  /** Run the same source again from a button in the panel. */
  | 'retry'
  /** Tab capture needs the toolbar icon click (LOS-17), so a panel button can't retry it. */
  | 'retry-via-icon'
  /** A denied mic prompt never re-prompts; send the user to Chrome's setting. */
  | 'open-mic-settings';

export interface ErrorCopy {
  readonly title: string;
  readonly body: string;
  readonly action?: ErrorAction;
}

const SOURCE_NAME: Record<SourceKind, string> = {
  tab: 'Tab audio',
  mic: 'The microphone',
  file: 'File playback',
};

/** Plain-language copy. Never shows error.message; that's for the console. */
export function copyFor(error: SourceError): ErrorCopy {
  switch (error.code) {
    case 'unavailable':
      return { title: `${SOURCE_NAME[error.kind]} isn't available yet.`, body: '' };
    case 'tab-ended':
      return { title: 'The captured tab was closed.', body: '' };
    case 'file-undecodable':
      return { title: "Couldn't decode that file.", body: '' };
    case 'tab-capture-failed':
      return {
        title: "Couldn't capture this tab",
        body: 'Some pages, like the Chrome Web Store and chrome:// pages, block capture. Switch to the tab you want to hear, then click the Audio Visualizer icon in the toolbar.',
        action: 'retry-via-icon',
      };
    case 'mic-denied':
      return {
        title: 'Microphone access is blocked',
        body: "Chrome won't ask again. Allow the microphone for Audio Visualizer in Chrome's settings, then try again.",
        action: 'open-mic-settings',
      };
    case 'mic-failed':
      return {
        title: "Couldn't start the microphone",
        body: 'Check that a microphone is connected and not in use by another app.',
        action: 'retry',
      };
  }
}
