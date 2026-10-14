import type { SourceKind } from './types';

/**
 * Every way a source can fail, as far as the user is concerned. Sources throw
 * (or report via onEnded) a SourceError with one of these; the side panel picks
 * the copy and the recovery action from the code, never from the message.
 */
export type SourceErrorCode =
  /** Source isn't built yet (a `TODO LOS-n` stub). */
  | 'unavailable'
  | 'tab-capture-failed'
  /** The captured tab closed or navigated away; its track fired `ended`. */
  | 'tab-ended'
  /** NotAllowedError. Chrome won't re-prompt; the user has to flip the setting. */
  | 'mic-denied'
  | 'mic-failed'
  /** decodeAudioData rejected the file. */
  | 'file-undecodable';

export class SourceError extends Error {
  override readonly name = 'SourceError';

  constructor(
    readonly code: SourceErrorCode,
    readonly kind: SourceKind,
    options?: { cause?: unknown; message?: string },
  ) {
    super(options?.message ?? `${kind} source: ${code}`, { cause: options?.cause });
  }
}

/** Classify anything a source threw. Sources should throw SourceError directly when they can. */
export function toSourceError(err: unknown, kind: SourceKind): SourceError {
  if (err instanceof SourceError) return err;

  const name = err instanceof Error ? err.name : '';
  const message = err instanceof Error ? err.message : String(err);

  if (message.startsWith('TODO LOS-')) return new SourceError('unavailable', kind, { cause: err });
  if (kind === 'mic' && (name === 'NotAllowedError' || name === 'SecurityError')) {
    return new SourceError('mic-denied', kind, { cause: err });
  }
  if (kind === 'file' && name === 'EncodingError') {
    return new SourceError('file-undecodable', kind, { cause: err });
  }

  return new SourceError(FALLBACK[kind], kind, { cause: err });
}

/** Anything unrecognised: a file that failed to load is, to the user, a file we couldn't read. */
const FALLBACK: Record<SourceKind, SourceErrorCode> = {
  tab: 'tab-capture-failed',
  mic: 'mic-failed',
  file: 'file-undecodable',
};
