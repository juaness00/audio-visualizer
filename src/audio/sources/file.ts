import type { AudioSource } from './types';

/**
 * decodeAudioData → AudioBufferSourceNode → engine.connect.
 * Cheapest source to build; it unblocks renderer work before capture lands.
 */
export function createFileSource(_file: File): AudioSource {
  throw new Error('TODO LOS-9: createFileSource');
}
