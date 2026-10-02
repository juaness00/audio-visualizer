import type { SourceKind } from '@/audio/sources/types';
import { copyFor, type ErrorAction, type PanelState } from './state';

export interface ViewHandlers {
  /** Error view's action button, when the action is 'retry'. */
  onRetry(): void;
  /** Error view's "Back to sources". */
  onDismiss(): void;
}

const LOADING_TEXT: Record<SourceKind, string> = {
  tab: 'Capturing this tab…',
  mic: 'Starting the microphone… If a permission tab opens, allow access there.',
  file: 'Decoding the file…',
};

// 'retry-via-icon' has no button: the body tells the user to click the toolbar icon.
const ACTION_LABEL: Partial<Record<ErrorAction, string>> = {
  retry: 'Try again',
  'open-mic-settings': 'Open microphone settings',
};

function el<T extends HTMLElement = HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`sidepanel: missing ${selector}`);
  return found;
}

/** Binds the state sections in index.html. Returns render(state). */
export function createViews(handlers: ViewHandlers): (state: PanelState) => void {
  const picker = el('#empty');
  const notice = el('#status');
  const loading = el('#loading');
  const loadingText = el('#loading-text');
  const error = el('#error');
  const errorTitle = el('#error-title');
  const errorBody = el('#error-body');
  const errorAction = el<HTMLButtonElement>('#error-action');
  const silent = el('#silent');
  const rail = el('#controls');

  let action: ErrorAction | undefined;
  errorAction.addEventListener('click', () => {
    if (action === 'retry') handlers.onRetry();
    // chrome:// URLs can't be opened from an <a href> in an extension page.
    if (action === 'open-mic-settings') {
      void chrome.tabs.create({ url: 'chrome://settings/content/microphone' });
    }
  });
  const errorBack = el<HTMLButtonElement>('#error-back');
  errorBack.addEventListener('click', () => handlers.onDismiss());

  return (state) => {
    picker.hidden = state.view !== 'picker';
    loading.hidden = state.view !== 'loading';
    error.hidden = state.view !== 'error';
    silent.hidden = !(state.view === 'playing' && state.silent);
    rail.hidden = state.view !== 'playing';

    if (state.view === 'picker') notice.textContent = state.notice ?? '';
    if (state.view === 'loading') loadingText.textContent = LOADING_TEXT[state.kind];
    if (state.view === 'error') {
      const copy = copyFor(state.error);
      errorTitle.textContent = copy.title;
      errorBody.textContent = copy.body;
      action = copy.action;
      const label = action && ACTION_LABEL[action];
      errorAction.hidden = !label;
      errorAction.textContent = label ?? '';
      (label ? errorAction : errorBack).focus();
    }
  };
}
