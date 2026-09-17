// Chrome won't show a permission prompt from a side panel or popup. This page
// runs in a real tab, so the prompt appears here. The grant is scoped to the
// extension origin, so the side panel can call getUserMedia afterwards without
// ever prompting again.
//
// Opened by the side panel (LOS-11): chrome.tabs.create({ url: chrome.runtime.getURL('permission.html') })

const message = document.querySelector<HTMLElement>('#message');

try {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  // We only wanted the grant. Release the device immediately.
  for (const track of stream.getTracks()) track.stop();
  window.close();
} catch (err) {
  if (message) {
    message.textContent =
      err instanceof DOMException && err.name === 'NotAllowedError'
        ? 'Microphone access was denied. You can change this at chrome://settings/content/microphone, then close this tab.'
        : `Could not access the microphone: ${err instanceof Error ? err.message : String(err)}`;
  }
}
