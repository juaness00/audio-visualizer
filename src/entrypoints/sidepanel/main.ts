import { createFileSource } from '@/audio/sources/file';
import { createMicSource } from '@/audio/sources/mic';
import { createTabSource } from '@/audio/sources/tab';
import type { AudioSource } from '@/audio/sources/types';
import { resizeToDisplaySize } from '@/utils/canvas';

const canvas = document.querySelector<HTMLCanvasElement>('#stage');
const status = document.querySelector<HTMLElement>('#status');
if (!canvas || !status) throw new Error('sidepanel: missing #stage or #status');

// Keep the canvas backing store matched to its CSS size × devicePixelRatio,
// otherwise everything renders blurry on retina panels.
const observer = new ResizeObserver(() => resizeToDisplaySize(canvas));
observer.observe(canvas);
resizeToDisplaySize(canvas);

function report(message: string) {
  status!.textContent = message;
}

// Each source is a stub until its Linear issue lands. Selecting one shows the
// TODO instead of throwing into the void, so the panel is never silently dead.
function select(make: () => AudioSource) {
  try {
    const source = make();
    report(`${source.kind} source ready`);
  } catch (err) {
    report(err instanceof Error ? err.message : String(err));
  }
}

document.querySelector('#src-tab')?.addEventListener('click', () => select(createTabSource));
document.querySelector('#src-mic')?.addEventListener('click', () => select(createMicSource));
document.querySelector<HTMLInputElement>('#src-file')?.addEventListener('change', (event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) select(() => createFileSource(file));
});
