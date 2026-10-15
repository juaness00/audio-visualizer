import type { AudioSource } from './types';

/**
 * chrome.tabCapture.getMediaStreamId → getUserMedia({ chromeMediaSource: 'tab' })
 * → createMediaStreamSource → engine.connect.
 *
 * Two traps:
 *  - The stream id is single-use and expires in seconds. Redeem it immediately.
 *  - Capturing mutes the tab. Also connect the stream to context.destination
 *    or the user's music goes silent.
 *
 * LOS-17 spike result (Chrome 154): this page CAN redeem the id, but only one
 * the service worker requests inside chrome.action.onClicked. Requesting it
 * from the panel fails with "Extension has not been invoked", and
 * openPanelOnActionClick never grants capture. So: replace
 * openPanelOnActionClick with action.onClicked + sidePanel.open, request the
 * id there, and hand it to this page. No offscreen document needed. Full
 * write-up on LOS-17.
 */
export function createTabSource(): AudioSource {
  throw new Error('TODO LOS-10: createTabSource');
}
