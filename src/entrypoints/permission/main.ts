import { MIC_CONSTRAINTS, microphoneError } from '@/audio/sources/mic';

const message = document.querySelector<HTMLElement>('#message');
const settings = document.querySelector<HTMLAnchorElement>('#mic-settings');
const requestId = new URLSearchParams(location.search).get('requestId');
settings?.addEventListener('click', (event) => {
  event.preventDefault();
  void chrome.tabs.create({ url: 'chrome://settings/content/microphone' });
});

async function notify(error?: unknown) {
  await chrome.runtime
    .sendMessage({
      type: 'microphone-permission',
      requestId,
      error: error ? microphoneError(error) : undefined,
      name: error instanceof Error ? error.name : undefined,
    })
    .catch(() => {});
}

try {
  const stream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
  for (const track of stream.getTracks()) track.stop();
  await notify();
  if (message)
    message.textContent =
      'Microphone allowed. You can close this tab and return to the visualizer.';
  window.close();
} catch (error) {
  if (message) message.textContent = microphoneError(error);
  if (settings) settings.hidden = false;
  await notify(error);
}
