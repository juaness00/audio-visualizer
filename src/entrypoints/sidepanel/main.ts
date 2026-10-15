import { createAudioEngine, type AudioEngine } from '@/audio/engine';
import { toSourceError } from '@/audio/sources/errors';
import { createFileSource } from '@/audio/sources/file';
import { createMicSource } from '@/audio/sources/mic';
import { createTabSource } from '@/audio/sources/tab';
import type { AudioSource, SourceKind } from '@/audio/sources/types';
import { normalizeSettings } from '@/settings/schema';
import { setupSettings } from './settings';
import { bars } from '@/render/modes/bars';
import { createRenderLoop } from '@/render/loop';
import { observeCanvasSize } from '@/utils/canvas';
import { INITIAL_STATE, nextState, type PanelEvent, type PanelState } from './state';
import { createViews } from './views';

const canvas = document.querySelector<HTMLCanvasElement>('#stage')!;
const stopButton = document.querySelector<HTMLButtonElement>('#stop')!;
const stopObserving = observeCanvasSize(canvas);

let state: PanelState = INITIAL_STATE;
let engine: AudioEngine | undefined;
let source: AudioSource | undefined;
let last: { kind: SourceKind; make: () => AudioSource } | undefined;
let generation = 0;
let settings = normalizeSettings(undefined);
const render = createViews({
  onRetry: () => last && void select(last.kind, last.make),
  onDismiss: () => dispatch({ type: 'dismiss' }),
});
void setupSettings((value) => {
  settings = value;
  engine?.setSmoothing(value.smoothing);
  engine?.setFftSize(value.fftSize);
});
const frame: { bins: Uint8Array; sampleRate: number; fftSize: number; pulse: number } = {
  bins: new Uint8Array(),
  sampleRate: 48000,
  fftSize: 2048,
  pulse: 0,
};
const loop = createRenderLoop({
  canvas,
  nextFrame() {
    frame.bins = engine!.getFrequencyData();
    frame.sampleRate = engine!.sampleRate;
    frame.fftSize = engine!.fftSize;
    return frame;
  },
  renderer: () => bars,
  settings: () => settings,
});

function dispatch(event: PanelEvent) {
  state = nextState(state, event);
  render(state);
  if (state.view === 'playing') loop.start();
  else loop.stop();
}

function stop() {
  generation++;
  source?.stop();
  source = undefined;
  engine?.disconnect();
  loop.stop();
}

async function select(kind: SourceKind, make: () => AudioSource) {
  stop();
  const current = generation;
  last = { kind, make };
  dispatch({ type: 'select', kind });
  try {
    source = make();
    engine ??= createAudioEngine(settings);
    // Resume synchronously from the click, before waiting for permission.
    await engine.resume();
    if (current !== generation) return;
    await source.start(engine, {
      onEnded(reason) {
        if (current !== generation) return;
        stop();
        dispatch({ type: 'ended', error: reason });
      },
    });
    if (current !== generation) return;
    dispatch({ type: 'started' });
  } catch (error) {
    if (current !== generation) return;
    stop();
    console.error(`sidepanel: ${kind} source failed`, error);
    dispatch({ type: 'failed', error: toSourceError(error, kind) });
  }
}

document
  .querySelector('#src-tab')
  ?.addEventListener('click', () => void select('tab', createTabSource));
document
  .querySelector('#src-mic')
  ?.addEventListener('click', () => void select('mic', createMicSource));
document.querySelector<HTMLInputElement>('#src-file')?.addEventListener('change', (event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) void select('file', () => createFileSource(file));
});
stopButton.addEventListener('click', () => {
  stop();
  state = { view: 'picker', notice: 'Stopped. Choose a source to start again.' };
  render(state);
});
window.addEventListener('pagehide', () => {
  stop();
  stopObserving();
  void engine?.context.close();
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
