import { createAudioEngine, type AudioEngine } from '@/audio/engine';
import { createFileSource } from '@/audio/sources/file';
import { createMicSource, microphoneError } from '@/audio/sources/mic';
import { createTabSource } from '@/audio/sources/tab';
import type { AudioSource } from '@/audio/sources/types';
import { normalizeSettings } from '@/settings/schema';
import { setupSettings } from './settings';
import { bars } from '@/render/modes/bars';
import { createRenderLoop } from '@/render/loop';
import { resizeToDisplaySize } from '@/utils/canvas';

const canvas = document.querySelector<HTMLCanvasElement>('#stage')!;
const status = document.querySelector<HTMLElement>('#status')!;
const settingsLink = document.querySelector<HTMLAnchorElement>('#mic-settings')!;
const stopButton = document.querySelector<HTMLButtonElement>('#stop')!;
const micButton = document.querySelector<HTMLButtonElement>('#src-mic')!;
const observer = new ResizeObserver(() => resizeToDisplaySize(canvas));
observer.observe(canvas);
resizeToDisplaySize(canvas);

let engine: AudioEngine | undefined;
let source: AudioSource | undefined;
let generation = 0;
let settings = normalizeSettings(undefined);
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

function stop() {
  generation++;
  source?.stop();
  source = undefined;
  engine?.disconnect();
  loop.stop();
  micButton.disabled = false;
  stopButton.hidden = true;
  document.querySelector('#empty')?.classList.remove('playing');
}

async function select(make: () => AudioSource) {
  stop();
  const current = generation;
  settingsLink.hidden = true;
  try {
    source = make();
    engine ??= createAudioEngine(settings);
    // Resume synchronously from the click, before waiting for permission.
    const resumed = engine.resume();
    micButton.disabled = source.kind === 'mic';
    stopButton.hidden = false;
    status.textContent =
      source.kind === 'mic'
        ? 'Setting up microphone. If a permission tab opens, allow access there.'
        : 'Starting audio…';
    await resumed;
    if (current !== generation) return;
    await source.start(engine);
    if (current !== generation) return;
    status.textContent = 'Visualizing microphone';
    document.querySelector('#empty')?.classList.add('playing');
    loop.start();
  } catch (error) {
    if (current !== generation) return;
    stop();
    status.textContent = microphoneError(error);
    settingsLink.hidden = !(error instanceof Error && error.name === 'NotAllowedError');
  }
}

document.querySelector('#src-tab')?.addEventListener('click', () => void select(createTabSource));
micButton.addEventListener('click', () => void select(createMicSource));
document.querySelector<HTMLInputElement>('#src-file')?.addEventListener('change', (event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) void select(() => createFileSource(file));
});
stopButton.addEventListener('click', () => {
  stop();
  status.textContent = 'Stopped. Choose a source to start again.';
});
settingsLink.addEventListener('click', (event) => {
  event.preventDefault();
  void chrome.tabs.create({ url: 'chrome://settings/content/microphone' });
});
window.addEventListener('pagehide', () => {
  stop();
  observer.disconnect();
  void engine?.context.close();
});
