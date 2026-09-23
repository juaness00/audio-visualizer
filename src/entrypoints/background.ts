import { defineBackground } from '#imports';
import { createSettingsPersistence } from '@/settings/persistence';
import type { SettingsCommand } from '@/settings/store';

export default defineBackground(() => {
  const settings = createSettingsPersistence();
  void settings
    .restore()
    .catch((error: unknown) => console.error('Settings recovery failed', error));
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || message?.type !== 'visualizer-settings') return;
    void settings.update(message.command as SettingsCommand).then(
      (state) => respond({ ok: true, state }),
      (error: unknown) =>
        respond({ ok: false, error: error instanceof Error ? error.message : String(error) }),
    );
    return true;
  });
  // Wakes the worker to recover pending writes after a browser restart.
  chrome.runtime.onStartup.addListener(() => {
    void settings
      .restore()
      .catch((error: unknown) => console.error('Settings recovery failed', error));
  });
  // Clicking the toolbar icon opens the side panel instead of a popup.
  // A popup would die the moment the user clicks away; the panel survives.
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err: unknown) => console.error('sidePanel.setPanelBehavior failed', err));
});
