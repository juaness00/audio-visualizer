import type { FileSource } from '@/audio/sources/file';

/** Slider resolution: 1000 steps across the whole file. */
const STEPS = 1000;

/** Seconds as m:ss, or h:mm:ss for an hour or more. Anything invalid shows 0:00. */
export function formatTime(seconds: number): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

export interface Transport {
  /** Bring the controls up to date with the source. */
  refresh(): void;
  /** Back to the start state, for a newly chosen file. */
  reset(): void;
}

/**
 * Binds play/pause, the seek slider and the loop toggle in index.html to
 * whatever file source is currently playing. views.ts decides when they show.
 */
export function setupTransport(current: () => FileSource | undefined): Transport {
  const playPause = document.querySelector<HTMLButtonElement>('#play-pause')!;
  const seek = document.querySelector<HTMLInputElement>('#seek')!;
  const time = document.querySelector<HTMLElement>('#time')!;
  const loop = document.querySelector<HTMLInputElement>('#loop')!;
  let dragging = false;
  let timer: ReturnType<typeof setInterval> | undefined;

  function show(seconds: number, length: number) {
    time.textContent = `${formatTime(seconds)} / ${formatTime(length)}`;
  }

  function refresh() {
    const source = current();
    if (!source) {
      // Nothing playing: stop the clock until the next file starts.
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
      return;
    }
    // Four updates a second is plenty for a clock showing whole seconds.
    timer ??= setInterval(refresh, 250);
    playPause.textContent = source.paused ? 'Play' : 'Pause';
    playPause.setAttribute('aria-pressed', String(source.paused));
    loop.checked = source.looping;
    const length = source.duration;
    if (!dragging) {
      seek.value = String(length > 0 ? Math.round((source.position() / length) * STEPS) : 0);
      show(source.position(), length);
    }
  }

  playPause.addEventListener('click', () => {
    const source = current();
    if (!source) return;
    if (source.paused) source.resume();
    else source.pause();
    refresh();
  });

  // While dragging, preview the time without jumping; jump once on release.
  seek.addEventListener('input', () => {
    const source = current();
    if (!source) return;
    dragging = true;
    show((Number(seek.value) / STEPS) * source.duration, source.duration);
  });
  seek.addEventListener('change', () => {
    const source = current();
    dragging = false;
    if (!source) return;
    source.seek((Number(seek.value) / STEPS) * source.duration);
    refresh();
  });

  loop.addEventListener('change', () => {
    current()?.setLoop(loop.checked);
    refresh();
  });

  return {
    refresh,
    reset() {
      dragging = false;
      seek.value = '0';
      loop.checked = false;
      playPause.textContent = 'Pause';
      playPause.setAttribute('aria-pressed', 'false');
      show(0, 0);
    },
  };
}
