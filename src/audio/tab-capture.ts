export const TAB_CAPTURE_PORT = 'audio-visualizer-tab-capture';
const HANDOFF_TIMEOUT_MS = 5000;

interface Panel {
  port: chrome.runtime.Port;
  prepare(requestId: string): Promise<void>;
}

/** Wait for the correct window's panel before minting an expiring stream ID. */
export function setupTabCapture() {
  const panels = new Map<number, Panel>();
  const waiting = new Map<number, Set<(panel: Panel) => void>>();
  const latest = new Map<number, string>();

  function panelFor(windowId: number): Promise<Panel> {
    const panel = panels.get(windowId);
    if (panel) return Promise.resolve(panel);
    return new Promise((resolve, reject) => {
      const listeners = waiting.get(windowId) ?? new Set();
      waiting.set(windowId, listeners);
      const ready = (panel: Panel) => {
        clearTimeout(timer);
        listeners.delete(ready);
        if (!listeners.size) waiting.delete(windowId);
        resolve(panel);
      };
      const timer = setTimeout(() => {
        listeners.delete(ready);
        if (!listeners.size) waiting.delete(windowId);
        reject(new Error('The audio visualizer panel did not open. Try the toolbar icon again.'));
      }, HANDOFF_TIMEOUT_MS);
      listeners.add(ready);
    });
  }

  chrome.runtime.onConnect.addListener((port) => {
    if (
      port.name !== TAB_CAPTURE_PORT ||
      port.sender?.id !== chrome.runtime.id ||
      port.sender.url !== chrome.runtime.getURL('sidepanel.html')
    )
      return;
    let windowId: number | undefined;
    const pending = new Map<string, { resolve(): void; reject(error: Error): void }>();
    const panel: Panel = {
      port,
      prepare(requestId) {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            pending.delete(requestId);
            reject(new Error('The audio visualizer panel stopped responding.'));
          }, HANDOFF_TIMEOUT_MS);
          pending.set(requestId, {
            resolve() {
              clearTimeout(timer);
              resolve();
            },
            reject(error) {
              clearTimeout(timer);
              reject(error);
            },
          });
          try {
            port.postMessage({ type: 'prepare', requestId });
          } catch (error) {
            pending
              .get(requestId)
              ?.reject(error instanceof Error ? error : new Error(String(error)));
            pending.delete(requestId);
          }
        });
      },
    };
    port.onMessage.addListener((message) => {
      if (message?.type === 'ready' && Number.isInteger(message.windowId)) {
        windowId = message.windowId;
        panels.set(message.windowId, panel);
        for (const ready of waiting.get(message.windowId) ?? []) ready(panel);
      }
      if (message?.type === 'prepared' && typeof message.requestId === 'string') {
        pending.get(message.requestId)?.resolve();
        pending.delete(message.requestId);
      }
    });
    port.onDisconnect.addListener(() => {
      if (windowId !== undefined && panels.get(windowId) === panel) panels.delete(windowId);
      for (const request of pending.values()) request.reject(new Error('The panel was closed.'));
      pending.clear();
    });
  });

  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: false })
    .catch((error: unknown) => console.error('sidePanel.setPanelBehavior failed', error));

  chrome.action.onClicked.addListener(async (tab) => {
    if (tab.id === undefined) return;
    const requestId = crypto.randomUUID();
    latest.set(tab.windowId, requestId);
    let panel: Panel | undefined;
    try {
      // Must run synchronously in the toolbar click's user gesture.
      await chrome.sidePanel.open({ windowId: tab.windowId });
      panel = await panelFor(tab.windowId);
      if (latest.get(tab.windowId) !== requestId) return;
      // Release an existing capture before requesting another for the same tab.
      await panel.prepare(requestId);
      if (latest.get(tab.windowId) !== requestId) return;
      const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
      if (latest.get(tab.windowId) !== requestId) return;
      panel.port.postMessage({ type: 'start', requestId, streamId });
    } catch (error) {
      console.error('Tab capture failed', error);
      if (latest.get(tab.windowId) === requestId) {
        try {
          panel?.port.postMessage({ type: 'failed', requestId });
        } catch {
          /* Panel closed. */
        }
      }
    } finally {
      if (latest.get(tab.windowId) === requestId) latest.delete(tab.windowId);
    }
  });
}
