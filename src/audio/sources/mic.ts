import type { AudioSource } from './types';

export const MIC_CONSTRAINTS = {
  audio: { echoCancellation: false, autoGainControl: false, noiseSuppression: false },
};

export function microphoneError(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError')
    return 'Microphone access is blocked. Allow access in Chrome microphone settings and your system privacy settings, then try again.';
  if (name === 'NotFoundError') return 'No microphone found. Connect a microphone and try again.';
  if (name === 'NotReadableError')
    return 'The microphone is unavailable. Check your device or close other apps using it, then try again.';
  return error instanceof Error ? error.message : String(error);
}

async function ensurePermission(signal: AbortSignal) {
  const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
  signal.throwIfAborted();
  if (permission.state === 'granted') return;
  if (permission.state === 'denied')
    throw new DOMException('Microphone blocked', 'NotAllowedError');

  await new Promise<void>((resolve, reject) => {
    let tabId: number | undefined;
    let settled = false;
    const requestId = crypto.randomUUID();
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      chrome.runtime.onMessage.removeListener(onMessage);
      chrome.tabs.onRemoved.removeListener(onRemoved);
      signal.removeEventListener('abort', onAbort);
      if (error) reject(error);
      else resolve();
    };
    const onMessage = (
      message: { type?: string; requestId?: string; error?: string; name?: string },
      sender: chrome.runtime.MessageSender,
    ) => {
      if (
        sender.id !== chrome.runtime.id ||
        message?.type !== 'microphone-permission' ||
        message.requestId !== requestId
      )
        return;
      finish(message.error ? new DOMException(message.error, message.name) : undefined);
    };
    const onRemoved = (id: number) => {
      if (id !== tabId) return;
      void navigator.permissions.query({ name: 'microphone' as PermissionName }).then(
        (state) =>
          finish(
            state.state === 'granted'
              ? undefined
              : new Error('Microphone setup was closed. Click Microphone to try again.'),
          ),
        (error: Error) => finish(error),
      );
    };
    const onAbort = () => {
      finish(new DOMException('Microphone setup cancelled', 'AbortError'));
      if (tabId !== undefined) void chrome.tabs.remove(tabId).catch(() => {});
    };
    chrome.runtime.onMessage.addListener(onMessage);
    chrome.tabs.onRemoved.addListener(onRemoved);
    signal.addEventListener('abort', onAbort, { once: true });
    void chrome.tabs
      .create({ url: chrome.runtime.getURL('permission.html?requestId=' + requestId) })
      .then(
        (tab) => {
          tabId = tab.id;
          if (signal.aborted && tabId !== undefined) void chrome.tabs.remove(tabId).catch(() => {});
        },
        (error: Error) => finish(error),
      );
  });
}

export function createMicSource(): AudioSource {
  let controller: AbortController | undefined;
  let stream: MediaStream | undefined;
  let node: MediaStreamAudioSourceNode | undefined;
  const stop = () => {
    controller?.abort();
    controller = undefined;
    node?.disconnect();
    node = undefined;
    stream?.getTracks().forEach((track) => track.stop());
    stream = undefined;
  };
  return {
    kind: 'mic',
    async start(engine) {
      stop();
      const attempt = new AbortController();
      controller = attempt;
      try {
        await ensurePermission(attempt.signal);
        const acquired = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
        if (attempt.signal.aborted) {
          acquired.getTracks().forEach((track) => track.stop());
          attempt.signal.throwIfAborted();
        }
        stream = acquired;
        node = engine.context.createMediaStreamSource(stream);
        engine.connect(node);
      } catch (error) {
        if (controller === attempt) stop();
        throw error;
      }
    },
    stop,
  };
}
