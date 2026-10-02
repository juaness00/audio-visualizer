import { SourceError } from '@/audio/sources/errors';
import type { PanelState } from './state';

/**
 * Dev only: `sidepanel.html?state=<name>` renders one of these, so every LOS-19
 * state can be checked by hand before the sources that trigger it exist.
 * main.ts imports this behind import.meta.env.DEV, so prod builds drop it.
 */
export const PREVIEWS: Record<string, PanelState> = {
  picker: { view: 'picker' },
  loading: { view: 'loading', kind: 'mic' },
  silent: { view: 'playing', kind: 'tab', silent: true },
  'tab-capture-failed': { view: 'error', error: new SourceError('tab-capture-failed', 'tab') },
  'tab-ended': { view: 'picker', notice: 'The captured tab was closed.' },
  'mic-denied': { view: 'error', error: new SourceError('mic-denied', 'mic') },
  'mic-failed': { view: 'error', error: new SourceError('mic-failed', 'mic') },
  'file-undecodable': { view: 'picker', notice: "Couldn't decode that file." },
};
