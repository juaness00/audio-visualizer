import type { AudioSource } from './types';

/**
 * getUserMedia({ audio }) → createMediaStreamSource → engine.connect.
 *
 * Chrome will not prompt for the mic from a side panel. Check
 * navigator.permissions.query({ name: 'microphone' }) first; if not granted,
 * open permission.html in a real tab (see src/entrypoints/permission) and
 * retry once it closes.
 *
 * Disable echoCancellation / autoGainControl / noiseSuppression — they flatten
 * the spectrum and make the visuals dull.
 */
export function createMicSource(): AudioSource {
  throw new Error('TODO LOS-11: createMicSource');
}
