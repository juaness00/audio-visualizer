import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupTabCapture, TAB_CAPTURE_PORT } from '@/audio/tab-capture';

function event<Args extends unknown[]>() {
  const listeners = new Set<(...args: Args) => unknown>();
  return {
    addListener: (listener: (...args: Args) => unknown) => listeners.add(listener),
    emit: (...args: Args) => Promise.all([...listeners].map((listener) => listener(...args))),
  };
}
function makePort() {
  return {
    name: TAB_CAPTURE_PORT,
    sender: { id: 'test', url: 'chrome-extension://test/sidepanel.html' },
    onMessage: event<[Record<string, unknown>]>(),
    onDisconnect: event<[]>(),
    postMessage: vi.fn(),
  };
}
let onConnect: ReturnType<typeof event<[ReturnType<typeof makePort>]>>;
let onClicked: ReturnType<typeof event<[{ id: number; windowId: number }]>>;
const open = vi.fn();
const getMediaStreamId = vi.fn();
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  open.mockResolvedValue(undefined);
  getMediaStreamId.mockResolvedValue('stream-id');
  onConnect = event();
  onClicked = event();
  vi.stubGlobal('chrome', {
    runtime: { id: 'test', getURL: (path: string) => 'chrome-extension://test/' + path, onConnect },
    sidePanel: { open, setPanelBehavior: vi.fn().mockResolvedValue(undefined) },
    action: { onClicked },
    tabCapture: { getMediaStreamId },
  });
  setupTabCapture();
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function ready(windowId = 1) {
  const port = makePort();
  await onConnect.emit(port);
  await port.onMessage.emit({ type: 'ready', windowId });
  return port;
}
async function acknowledge(port: ReturnType<typeof makePort>) {
  const prepare = port.postMessage.mock.calls.at(-1)![0];
  expect(prepare.type).toBe('prepare');
  await port.onMessage.emit({ type: 'prepared', requestId: prepare.requestId });
  return prepare.requestId;
}

describe('toolbar capture handoff', () => {
  it('opens synchronously, waits for a cold panel, and releases old capture before minting an ID', async () => {
    const click = onClicked.emit({ id: 42, windowId: 1 });
    expect(open).toHaveBeenCalledWith({ windowId: 1 });
    await flush();
    expect(getMediaStreamId).not.toHaveBeenCalled();
    const port = await ready();
    await flush();
    expect(getMediaStreamId).not.toHaveBeenCalled();
    const requestId = await acknowledge(port);
    await click;
    expect(getMediaStreamId).toHaveBeenCalledExactlyOnceWith({ targetTabId: 42 });
    expect(port.postMessage).toHaveBeenLastCalledWith({
      type: 'start',
      requestId,
      streamId: 'stream-id',
    });
  });

  it('routes capture only to the clicked window', async () => {
    const other = await ready(2);
    const port = await ready(1);
    const click = onClicked.emit({ id: 42, windowId: 1 });
    await flush();
    await acknowledge(port);
    await click;
    expect(other.postMessage).not.toHaveBeenCalled();
  });

  it('reports capture denial to the panel', async () => {
    getMediaStreamId.mockRejectedValue(new Error('Restricted page'));
    const port = await ready();
    const click = onClicked.emit({ id: 42, windowId: 1 });
    await flush();
    const requestId = await acknowledge(port);
    await click;
    expect(port.postMessage).toHaveBeenLastCalledWith({ type: 'failed', requestId });
  });

  it('cancels a handoff if the panel closes before acknowledging', async () => {
    const port = await ready();
    const click = onClicked.emit({ id: 42, windowId: 1 });
    await flush();
    await port.onDisconnect.emit();
    await click;
    expect(getMediaStreamId).not.toHaveBeenCalled();
  });

  it('does not deliver a stale stream after a newer toolbar click', async () => {
    let resolve!: (id: string) => void;
    getMediaStreamId.mockImplementationOnce(
      () =>
        new Promise<string>((done) => {
          resolve = done;
        }),
    );
    const port = await ready();
    const first = onClicked.emit({ id: 42, windowId: 1 });
    await flush();
    await acknowledge(port);
    await flush();
    const second = onClicked.emit({ id: 43, windowId: 1 });
    await flush();
    const requestId = await acknowledge(port);
    await second;
    resolve('stale-id');
    await first;
    const starts = port.postMessage.mock.calls
      .map(([message]) => message)
      .filter((m) => m.type === 'start');
    expect(starts).toEqual([{ type: 'start', requestId, streamId: 'stream-id' }]);
  });

  it('times out instead of minting an ID for a panel that never opens', async () => {
    const click = onClicked.emit({ id: 42, windowId: 1 });
    await vi.advanceTimersByTimeAsync(5001);
    await click;
    expect(getMediaStreamId).not.toHaveBeenCalled();
  });
});
