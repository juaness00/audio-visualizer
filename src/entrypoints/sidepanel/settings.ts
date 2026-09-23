import { normalizeSettings, type VisualizerSettings } from '@/settings/schema';
import {
  BUILT_IN_PRESETS,
  deletePreset,
  loadState,
  savePreset,
  saveSettings,
} from '@/settings/store';
import type { Preset } from '@/settings/presets';
import { PENDING_KEY, SYNC_ERROR_KEY } from '@/settings/storage';

export function setupSettings(onChange: (settings: VisualizerSettings) => void) {
  const form = document.querySelector<HTMLFieldSetElement>('#settings-fields')!;
  const message = document.querySelector<HTMLElement>('#settings-status')!;
  const retry = document.querySelector<HTMLButtonElement>('#settings-retry')!;
  const picker = document.querySelector<HTMLSelectElement>('#preset')!;
  const name = document.querySelector<HTMLInputElement>('#preset-name')!;
  const remove = document.querySelector<HTMLButtonElement>('#preset-delete')!;
  const save = document.querySelector<HTMLButtonElement>('#preset-save')!;
  const input = (id: string) =>
    document.querySelector<HTMLInputElement | HTMLSelectElement>('#' + id)!;
  let active = normalizeSettings(undefined);
  let custom: Preset[] = [];
  let edit = 0;
  let loaded = false;

  function report(error: unknown) {
    message.textContent = error instanceof Error ? error.message : String(error);
    retry.hidden = false;
  }
  function options() {
    const selection = picker.value;
    picker.replaceChildren(new Option('Choose a preset', ''));
    for (const [label, presets] of [
      ['Built in', BUILT_IN_PRESETS],
      ['My presets', custom],
    ] as const) {
      const group = document.createElement('optgroup');
      group.label = label;
      for (const preset of presets) group.append(new Option(preset.name, preset.id));
      picker.append(group);
    }
    picker.value = selection;
    remove.disabled = !custom.some((preset) => preset.id === picker.value);
  }
  function display() {
    for (const [id, value] of [
      ['gain', active.gain],
      ['smoothing', active.smoothing],
      ['low', active.range.low],
      ['high', active.range.high],
      ['fft-size', active.fftSize],
    ] as const)
      input(id).value = String(value);
    input('palette').value = active.palette.join(', ');
    input('hue-mode').value = active.hueMode;
    document.querySelector('#gain-value')!.textContent = active.gain.toFixed(1);
    document.querySelector('#smoothing-value')!.textContent = active.smoothing.toFixed(2);
  }
  async function persist() {
    const revision = ++edit;
    retry.hidden = true;
    message.textContent = 'Saving…';
    try {
      await saveSettings(active);
      if (revision === edit) message.textContent = 'Saved on this device; sync pending.';
    } catch (error) {
      if (revision === edit) report(error);
    }
  }
  function apply(settings: VisualizerSettings) {
    active = normalizeSettings(settings);
    display();
    onChange(active);
    void persist();
  }
  for (const id of ['gain', 'smoothing']) {
    input(id).addEventListener('input', () => {
      picker.value = '';
      remove.disabled = true;
      apply({ ...active, [id]: Number(input(id).value) });
    });
  }
  for (const id of ['low', 'high', 'fft-size', 'hue-mode', 'palette']) {
    input(id).addEventListener('change', () => {
      const low = Number(input('low').value);
      const high = Number(input('high').value);
      const palette = input('palette')
        .value.split(',')
        .map((color) => color.trim());
      if (
        !Number.isFinite(low) ||
        !Number.isFinite(high) ||
        low < 0 ||
        high > 24000 ||
        low >= high
      ) {
        message.textContent = 'Use a frequency range from 0 to 24000 Hz with Low below High.';
        display();
        return;
      }
      if (
        !palette.length ||
        palette.length > 8 ||
        palette.some((color) => !/^#[0-9a-f]{6}$/i.test(color))
      ) {
        message.textContent = 'Use 1–8 comma-separated colors, such as #56ccf2, #bb6bd9.';
        display();
        return;
      }
      picker.value = '';
      remove.disabled = true;
      apply({
        ...active,
        range: { low, high },
        palette,
        fftSize: Number(input('fft-size').value),
        hueMode: input('hue-mode').value === 'amplitude' ? 'amplitude' : 'frequency',
      });
    });
  }
  picker.addEventListener('change', () => {
    const preset = [...BUILT_IN_PRESETS, ...custom].find((item) => item.id === picker.value);
    remove.disabled = !custom.some((item) => item.id === picker.value);
    if (preset) {
      name.value = preset.name;
      apply(preset.settings);
    }
  });
  save.addEventListener('click', async () => {
    save.disabled = true;
    try {
      const state = await savePreset(name.value, active);
      custom = state.presets;
      options();
      picker.value =
        custom.find((preset) => preset.name.toLowerCase() === name.value.trim().toLowerCase())
          ?.id ?? '';
      remove.disabled = !picker.value;
      message.textContent = 'Preset saved.';
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : String(error);
    } finally {
      save.disabled = false;
    }
  });
  remove.addEventListener('click', async () => {
    remove.disabled = true;
    try {
      const state = await deletePreset(picker.value);
      custom = state.presets;
      picker.value = '';
      options();
      message.textContent = 'Preset deleted. Your current settings are unchanged.';
    } catch (error) {
      message.textContent = error instanceof Error ? error.message : String(error);
      remove.disabled = false;
    }
  });
  async function restore() {
    retry.hidden = true;
    try {
      const state = await loadState();
      active = state.settings;
      custom = state.presets;
      options();
      display();
      onChange(active);
      loaded = true;
      form.disabled = false;
      message.textContent = 'Settings restored.';
    } catch (error) {
      report(error);
    }
  }
  retry.addEventListener('click', () => void (loaded ? persist() : restore()));
  const changed = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== 'local') return;
    if (changes[SYNC_ERROR_KEY]?.newValue)
      message.textContent = String(changes[SYNC_ERROR_KEY].newValue);
    else if (changes[PENDING_KEY] && !changes[PENDING_KEY].newValue)
      message.textContent = 'Settings saved.';
  };
  chrome.storage.onChanged.addListener(changed);
  window.addEventListener('pagehide', () => chrome.storage.onChanged.removeListener(changed), {
    once: true,
  });
  return restore();
}
