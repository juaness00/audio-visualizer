import { createAudioEngine, type AudioEngine } from '@/audio/engine';
import { toSourceError } from '@/audio/sources/errors';
import { createFileSource, isFileSource } from '@/audio/sources/file';
import { createMicSource } from '@/audio/sources/mic';
import { createTabSource } from '@/audio/sources/tab';
import { TAB_CAPTURE_PORT } from '@/audio/tab-capture';
import type { AudioSource, SourceKind } from '@/audio/sources/types';
import { normalizeSettings } from '@/settings/schema';
import { setupSettings } from './settings';
import { bars } from '@/render/modes/bars';
import { particles } from '@/render/modes/particles';
import { radial } from '@/render/modes/radial';
import { waveform } from '@/render/modes/waveform';
import { awareness } from '@/render/modes/awareness';
import { createRenderLoop } from '@/render/loop';
import { observeCanvasSize } from '@/utils/canvas';
import { INITIAL_STATE, nextState, type PanelEvent, type PanelState } from './state';
import { createViews } from './views';
import { setupTransport } from './transport';
import { setupDropZone } from './drop';

const canvas = document.querySelector<HTMLCanvasElement>('#stage')!;
const stopButton = document.querySelector<HTMLButtonElement>('#stop')!;
const nowPlaying = document.querySelector<HTMLElement>('#now-playing')!;
const stopObserving = observeCanvasSize(canvas);

let state: PanelState = INITIAL_STATE;
let engine: AudioEngine | undefined;
let source: AudioSource | undefined;
let last: { kind: SourceKind; make: () => AudioSource } | undefined;
let generation = 0;
let captureRequest: string | undefined;
let settings = normalizeSettings(undefined);
let renderer = bars;
let sourceTitle = '';
const transport = setupTransport(() => (isFileSource(source) ? source : undefined));
const render = createViews({
  onRetry: () => last && void select(last.kind, last.make),
  onDismiss: () => dispatch({ type: 'dismiss' }),
});
void setupSettings((value) => {
  const nextRenderer =
    value.mode === 'particles'
      ? particles
      : value.mode === 'radial'
        ? radial
        : value.mode === 'waveform'
          ? waveform
            : value.mode === 'awareness'
              ? awareness
            : bars;
  if (renderer !== nextRenderer) {
    renderer.reset?.();
    nextRenderer.reset?.();
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    renderer = nextRenderer;
  }
  settings = value;
  engine?.setSmoothing(value.smoothing);
  engine?.setFftSize(value.fftSize);
});
const frame: {
  bins: Uint8Array;
  waveform: Uint8Array;
  sampleRate: number;
  fftSize: number;
  pulse: number;
} = {
  bins: new Uint8Array(),
  waveform: new Uint8Array(),
  sampleRate: 48000,
  fftSize: 2048,
  pulse: 0,
};
const loop = createRenderLoop({
  canvas,
  nextFrame() {
    frame.bins = engine!.getFrequencyData();
    frame.waveform = engine!.getTimeDomainData();
    frame.sampleRate = engine!.sampleRate;
    frame.fftSize = engine!.fftSize;
    return frame;
  },
  renderer: () => renderer,
  settings: () => settings,
});

function dispatch(event: PanelEvent) {
  state = nextState(state, event);
  render(state);
  if (state.view === 'playing') transport.refresh();
  if (state.view === 'playing') loop.start();
  else loop.stop();
}

function stop() {
  captureRequest = undefined;
  generation++;
  source?.stop();
  source = undefined;
  engine?.disconnect();
  loop.stop();
  renderer.reset?.();
}

async function select(kind: SourceKind, make: () => AudioSource) {
  stop();
  const current = generation;
  last = { kind, make };
  nowPlaying.textContent = `Playing: ${sourceTitle || sourceName(kind)}`;
  dispatch({ type: 'select', kind });
  try {
    source = make();
    engine ??= createAudioEngine(settings);
    // Mic/file selection comes from a panel click. Tab capture arrives from
    // the toolbar, so acquire its stream before resuming the audio context.
    if (kind !== 'tab') await engine.resume();
    if (current !== generation) return;
    await source.start(engine, {
      onEnded(reason) {
        if (current !== generation) return;
        stop();
        dispatch({ type: 'ended', error: reason });
      },
    });
    if (current !== generation) return;
    if (kind === 'tab') await engine.resume();
    if (current !== generation) return;
    dispatch({ type: 'started' });
  } catch (error) {
    if (current !== generation) return;
    stop();
    console.error(`sidepanel: ${kind} source failed`, error);
    dispatch({ type: 'failed', error: toSourceError(error, kind) });
  }

  function sourceName(kind: SourceKind) {
    return kind === 'file' ? 'Audio file' : kind === 'mic' ? 'Microphone' : 'This tab';
  }
}

document.querySelector('#src-tab')?.addEventListener('click', () => {
  stop();
  state = {
    view: 'picker',
    notice:
      'Open the tab you want to hear, then click the Audio Visualizer icon in the toolbar to capture it.',
  };
  render(state);
});
document.querySelector('#src-mic')?.addEventListener('click', () => {
  sourceTitle = 'Microphone';
  void select('mic', createMicSource);
});
/** The picker and a drop both end up here. */
function playFile(file: File) {
  sourceTitle = file.name;
  transport.reset();
  void select('file', () => createFileSource(file));
}
document.querySelector<HTMLInputElement>('#src-file')?.addEventListener('change', (event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (file) playFile(file);
});
const stopDropZone = setupDropZone(document.querySelector<HTMLElement>('.panel')!, playFile);
stopButton.addEventListener('click', () => {
  stop();
  state = { view: 'picker', notice: 'Stopped. Choose a source to start again.' };
  render(state);
});
window.addEventListener('pagehide', () => {
  stop();
  stopObserving();
  stopDropZone();
  void engine?.context.close();
});

render(state);

// A port handshake prevents losing the stream ID while a newly opened panel loads.
let capturePort: chrome.runtime.Port | undefined;
let reconnect: ReturnType<typeof setTimeout> | undefined;
let closed = false;
function connectCapture() {
  if (closed) return;
  const port = chrome.runtime.connect({ name: TAB_CAPTURE_PORT });
  capturePort = port;
  port.onMessage.addListener((message) => {
    if (typeof message?.requestId !== 'string') return;
    if (message.type === 'prepare') {
      stop();
      sourceTitle = 'This tab';
      captureRequest = message.requestId;
      dispatch({ type: 'select', kind: 'tab' });
      port.postMessage({ type: 'prepared', requestId: message.requestId });
    } else if (message.requestId === captureRequest) {
      if (message.type === 'start' && typeof message.streamId === 'string') {
        void select('tab', () => createTabSource(message.streamId));
      } else if (message.type === 'failed') {
        stop();
        dispatch({ type: 'failed', error: toSourceError(new Error('Tab capture failed'), 'tab') });
      }
    }
  });
  port.onDisconnect.addListener(() => {
    // Reading lastError also handles the worker being restarted during development.
    void chrome.runtime.lastError;
    if (captureRequest) {
      stop();
      dispatch({ type: 'failed', error: toSourceError(new Error('Capture interrupted'), 'tab') });
    }
    if (!closed) reconnect = setTimeout(connectCapture, 500);
  });
  void chrome.windows
    .getCurrent()
    .then((window) => {
      if (!closed && capturePort === port) port.postMessage({ type: 'ready', windowId: window.id });
    })
    .catch((error: unknown) => console.error('Could not connect tab capture', error));
}
connectCapture();
window.addEventListener('pagehide', () => {
  closed = true;
  clearTimeout(reconnect);
  capturePort?.disconnect();
});

if (import.meta.env.DEV) {
  const name = new URLSearchParams(location.search).get('state');
  if (name) {
    const { PREVIEWS } = await import('./previews');
    const preview = PREVIEWS[name];
    if (preview) render((state = preview));
    else console.warn(`sidepanel: no preview "${name}". Try: ${Object.keys(PREVIEWS).join(', ')}`);
  }
}
