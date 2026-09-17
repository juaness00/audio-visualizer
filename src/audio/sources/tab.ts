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
 * Whether this page can redeem the id itself is what LOS-17 (spike) decides.
 * If it can't, the graph moves to an offscreen document and this file becomes
 * a message-passing client.
 */
export function createTabSource(): AudioSource {
  throw new Error('TODO LOS-10: createTabSource (blocked by spike LOS-17)');
}
