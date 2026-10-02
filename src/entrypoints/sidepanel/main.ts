import { createAudioEngine, type AudioEngine } from '@/audio/engine';
import { toSourceError } from '@/audio/sources/errors';
import { createFileSource } from '@/audio/sources/file';
import { createMicSource } from '@/audio/sources/mic';
import { createTabSource } from '@/audio/sources/tab';
import type { AudioSource, SourceKind } from '@/audio/sources/types';
import { DEFAULT_SETTINGS } from '@/settings/schema';
import { observeCanvasSize } from '@/utils/canvas';
import { INITIAL_STATE, nextState, type PanelEvent, type PanelState } from './state';
import { createViews } from './views';

const canvas = document.querySelector<HTMLCanvasElement>('#stage');
if (!canvas) throw new Error('sidepanel: missing #stage');

observeCanvasSize(canvas);

let state: PanelState = INITIAL_STATE;
let engine: AudioEngine | undefined;
let source: AudioSource | undefined;
let last: { kind: SourceKind; make: () => AudioSource } | undefined;
// Bumped on every select, so a slow start() from an abandoned source can't
// overwrite the state of the one the user picked after it.
let generation = 0;

const render = createViews({
  onRetry: () => last && void select(last.kind, last.make),
  onDismiss: () => dispatch({ type: 'dismiss' }),
});

// LOS-12: start/stop the render loop on rendersCanvas(state) here, and feed
// createSilenceDetector (src/audio/silence.ts) to dispatch 'silence'/'sound'.
function dispatch(event: PanelEvent) {
  state = nextState(state, event);
  render(state);
}

function release() {
  source?.stop();
  source = undefined;
  engine?.disconnect();
}

async function select(kind: SourceKind, make: () => AudioSource) {
  const current = ++generation;
  release();
  last = { kind, make };
  dispatch({ type: 'select', kind });
  try {
    source = make();
    engine ??= createAudioEngine(DEFAULT_SETTINGS);
    // Called before the first await, so it's still inside the click's user
    // gesture; contexts start suspended.
    await engine.resume();
    if (current !== generation) return;
    await source.start(engine, {
      onEnded(reason) {
        if (current !== generation) return;
        release();
        dispatch({ type: 'ended', error: reason });
      },
    });
    if (current !== generation) return;
    dispatch({ type: 'started' });
  } catch (err) {
    if (current !== generation) return;
    console.error(`sidepanel: ${kind} source failed`, err);
    release();
    dispatch({ type: 'failed', error: toSourceError(err, kind) });
  }
}

document.querySelector('#src-tab')?.addEventListener('click', () => {
  void select('tab', createTabSource);
});
document.querySelector('#src-mic')?.addEventListener('click', () => {
  void select('mic', createMicSource);
});
document.querySelector<HTMLInputElement>('#src-file')?.addEventListener('change', (event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  // Clear so picking the same file again still fires 'change'.
  input.value = '';
  if (file) void select('file', () => createFileSource(file));
});

render(state);

if (import.meta.env.DEV) {
  const name = new URLSearchParams(location.search).get('state');
  if (name) {
    const { PREVIEWS } = await import('./previews');
    const preview = PREVIEWS[name];
    if (preview) render((state = preview));
    else console.warn(`sidepanel: no preview "${name}". Try: ${Object.keys(PREVIEWS).join(', ')}`);
  }
}
