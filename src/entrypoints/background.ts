import { defineBackground } from '#imports';

export default defineBackground(() => {
  // Clicking the toolbar icon opens the side panel instead of a popup.
  // A popup would die the moment the user clicks away; the panel survives.
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err: unknown) => console.error('sidePanel.setPanelBehavior failed', err));
});
